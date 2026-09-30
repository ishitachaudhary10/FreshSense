import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ImageUpload from '@/components/ImageUpload';
import { ResultCard } from '@/components/ResultCard';
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from '@/components/ui/button';

interface AnalysisResult {
  status: 'fresh' | 'spoiled' | 'uncertain';
  confidence: number;
  date: Date;
  foodType: string;
  model_used?: 'cnn' | 'yolo';
}

const Index = () => {
  const navigate = useNavigate();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'cnn' | 'yolo'>('cnn');
  const { toast } = useToast();

  const extractFoodType = (prediction: string | undefined): string => {
    if (!prediction) return 'Unknown';

    if (prediction.includes(' ')) {
      const parts = prediction.split(' ');
      if (parts.length > 1 && (parts[0] === 'Fresh' || parts[0] === 'Spoiled')) {
        return parts.slice(1).join(' ');
      }
      return prediction;
    }
    else if (prediction.includes('_')) {
      const parts = prediction.split('_');
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
    return prediction;
  };

  const mapPredictionToStatus = (prediction: string | undefined): 'fresh' | 'spoiled' | 'uncertain' => {
    if (!prediction) return 'uncertain';

    const lowerCasePrediction = prediction.toLowerCase();

    if (prediction.startsWith('Fresh')) return 'fresh';
    if (prediction.startsWith('Spoiled')) return 'spoiled';

    if (lowerCasePrediction.includes('_fresh') && !lowerCasePrediction.includes('medium')) return 'fresh';
    if (lowerCasePrediction.includes('rotten')) return 'spoiled';
    if (lowerCasePrediction.includes('medium_fresh')) return 'uncertain';

    if (prediction === "Fruits-Vegetables") {
        return 'uncertain';
    }

    console.warn(`Unknown prediction format for status mapping: ${prediction}`);
    return 'uncertain';
  };

  const handleImageSelect = async (file: File) => {
    if (!file) return;
    setIsAnalyzing(true);
    setResult(null);
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('model_type', selectedModel);

      const apiUrl = process.env.NODE_ENV === 'production'
        ? 'https://food-backend-6yql.onrender.com'
        : 'http://localhost:5000';
      console.log(`Sending request to: ${apiUrl}/predict with model: ${selectedModel}`);

      const response = await fetch(`${apiUrl}/predict`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Detection failed with status: ' + response.status }));
        throw new Error(errorData.error || 'Detection failed');
      }

      const data = await response.json();
      console.log('API Response:', data);

      if (!data.predicted_class || typeof data.confidence === 'undefined') {
        throw new Error('Invalid response format from server');
      }

      const analysisResult: AnalysisResult = {
        status: mapPredictionToStatus(data.predicted_class),
        confidence: Math.round(data.confidence * 100),
        date: new Date(),
        foodType: extractFoodType(data.predicted_class),
        model_used: data.model_used
      };

      setResult(analysisResult);

      toast({
        title: "Classification Complete",
        description: `Analyzed using ${data.model_used?.toUpperCase()} model.`,
      });
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      toast({
        title: "Classification Failed",
        description: `Error: ${errorMessage}. Please try again.`,
        variant: "destructive",
      });
      setResult(null);
    } finally {
      setIsAnalyzing(false);
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream-50 to-cream-100 py-8 md:py-16">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 md:p-12">
            <div className="text-center mb-8 md:mb-12">
              <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-3 md:mb-4">
                Food Freshness Detective
              </h1>
              <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
                Your AI-powered food safety companion. Upload a photo to instantly check food freshness and get guidance on food safety.
              </p>
            </div>

            <div className="max-w-2xl mx-auto mb-8 md:mb-12">
              <div className="mb-6">
                <Label className="text-lg font-medium text-gray-700 mb-2 block">Select Model</Label>
                <RadioGroup
                  defaultValue="cnn"
                  value={selectedModel}
                  onValueChange={(value: 'cnn' | 'yolo') => setSelectedModel(value)}
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cnn" id="cnn" />
                    <Label htmlFor="cnn" className="font-normal">CNN (Standard)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yolo" id="yolo" />
                    <Label htmlFor="yolo" className="font-normal">YOLO (Object Detection)</Label>
                  </div>
                </RadioGroup>
              </div>

              <ImageUpload
                onImageSelect={handleImageSelect}
                isProcessing={isProcessing}
              />

              {isAnalyzing && (
                <div className="text-center mt-6 md:mt-8">
                  <Loader2 className="w-8 h-8 text-sage-600 animate-spin mx-auto" />
                  <p className="text-gray-600 mt-2">Analyzing your image using {selectedModel.toUpperCase()}...</p>
                </div>
              )}

              {result && !isAnalyzing && (
                <div className="mt-6 md:mt-8 animate-fade-in">
                  <ResultCard {...result} />
                  {(result.status === 'fresh' || result.status === 'uncertain') && (
                    <div className="mt-4 text-center">
                      <Button
                        onClick={() => navigate('/preserve', { state: { foodType: result.foodType } })}
                        variant="outline"
                      >
                        See Prevention Techniques
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
              <div className="bg-gray-50 p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Food Safety Analysis</h2>
                <p className="text-gray-600">
                  Our advanced AI model analyzes your food images to detect signs of spoilage, helping you make informed decisions about food safety and consumption.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Treatment Guide</h2>
                <p className="text-gray-600">
                  If you've consumed spoiled food, get immediate guidance on symptoms to watch for and recommended first-aid steps to take.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-xl shadow-sm">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Prevention Tips</h2>
                <p className="text-gray-600">
                  Learn best practices for food storage, handling, and preservation to prevent food spoilage and maintain food safety in your home.
                </p>
              </div>
            </div>

            <div className="mt-12 bg-gray-50 p-8 rounded-xl shadow-sm">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">Emergency Response Guide</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-3">Common Symptoms</h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-2">
                    <li>Nausea and vomiting</li>
                    <li>Stomach cramps</li>
                    <li>Diarrhea</li>
                    <li>Fever</li>
                    <li>Dehydration</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-800 mb-3">Immediate Actions</h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-2">
                    <li>Stay hydrated with water and electrolytes</li>
                    <li>Rest and monitor symptoms</li>
                    <li>Avoid solid foods temporarily</li>
                    <li>Seek medical attention if symptoms are severe</li>
                    <li>Document what was consumed</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-12 border-t pt-8">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-red-800 mb-3">Important Disclaimer</h3>
                <p className="text-red-700 text-sm leading-relaxed">
                  This tool is designed to assist in food safety assessment but should not be considered as definitive medical advice. The AI predictions are meant to be informative but not conclusive. If you suspect food poisoning or have consumed spoiled food, please seek immediate medical attention. In case of emergency, contact your local emergency services or healthcare provider. We are not liable for any decisions made based on the tool's analysis.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
