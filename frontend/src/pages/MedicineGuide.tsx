import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Pill, AlertTriangle, Info, Loader2, RefreshCcw } from 'lucide-react';
import { getMedicineRecommendations, initializeGemini } from '@/services/geminiService';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

const MedicineGuide = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const { toast } = useToast();

  const fetchRecommendations = async () => {
    setIsLoading(true);
    setError(false);
    try {
      // Initialize Gemini with API key
      const apiKey = 'AIzaSyDzuznETcHZQH4QljdQ5_g40HgkHmCk_ZY';
      
      // Initialize Gemini
      initializeGemini(apiKey);
      
      // Fetch recommendations from Gemini with more specific prompt
      const data = await getMedicineRecommendations('food', 'contaminated');
      
      // Validate the response structure
      if (data && Array.isArray(data) && data.length > 0 && 
          data.every(item => 
            item.severity && 
            Array.isArray(item.symptoms) && 
            Array.isArray(item.medicines) &&
            item.medicines.every(med => med.name && med.usage && med.note)
          )) {
        setRecommendations(data);
      } else {
        throw new Error('Invalid response format from Gemini');
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setError(true);
      toast({
        title: "Failed to load recommendations",
        description: error.message || "Unable to generate treatment guide. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const ErrorScreen = () => (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <AlertTriangle className="w-16 h-16 text-red-500 mb-6" />
      <h2 className="text-2xl font-semibold text-gray-900 mb-3">
        Unable to Generate Treatment Guide
      </h2>
      <p className="text-gray-600 mb-8 max-w-md">
        We're having trouble generating the treatment recommendations. 
        This could be due to a temporary issue or network connection problem.
      </p>
      <Button 
        onClick={fetchRecommendations}
        className="flex items-center gap-2 bg-sage-600 hover:bg-sage-700 text-white"
      >
        <RefreshCcw className="w-4 h-4" />
        Try Again
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream-50 to-cream-100">
      <div className="container px-4 py-8 mx-auto max-w-4xl">
        <Link
          to="/"
          className="inline-flex items-center text-sage-600 hover:text-sage-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Analysis
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Food Poisoning Treatment Guide
          </h1>
          <p className="text-xl text-gray-600">
            Recommended medicines and treatments based on symptoms
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-md rounded-xl p-6 mb-8 border border-red-200">
          <div className="flex items-start space-x-3 text-red-600">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold">Important Medical Disclaimer</h3>
              <p className="text-sm text-red-500">
                This guide is for informational purposes only. Always consult a healthcare
                professional before taking any medication. Seek immediate medical attention
                for severe symptoms or if conditions worsen.
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-sage-600 animate-spin" />
            <p className="text-gray-600 mt-4">Generating treatment recommendations...</p>
          </div>
        ) : error ? (
          <ErrorScreen />
        ) : (
          <>
            {recommendations.map((rec, index) => (
              <div
                key={index}
                className="bg-white/80 backdrop-blur-md rounded-xl p-6 mb-6 border border-sage-100"
              >
                <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                  <Pill className="w-5 h-5 mr-2 text-sage-600" />
                  {rec.severity} Symptoms
                </h2>

                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Common Symptoms:</h3>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    {rec.symptoms.map((symptom, idx) => (
                      <li key={idx}>{symptom}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Recommended Medicines:</h3>
                  <div className="space-y-4">
                    {rec.medicines.map((med, idx) => (
                      <div
                        key={idx}
                        className="bg-sage-50 rounded-lg p-4 border border-sage-100"
                      >
                        <h4 className="font-medium text-gray-800">{med.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{med.usage}</p>
                        <div className="flex items-start mt-2 text-sm text-sage-600">
                          <Info className="w-4 h-4 mr-1 flex-shrink-0 mt-0.5" />
                          <p>{med.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            <div className="text-center text-gray-600 text-sm mt-8">
              Remember to stay hydrated and rest while recovering. If symptoms persist or
              worsen, please seek professional medical help immediately.
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MedicineGuide;
