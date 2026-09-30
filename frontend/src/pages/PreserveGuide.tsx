import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const WEATHER_API_KEY = '83545c5eda2941881cc4b48edafb9360'; // Your OpenWeatherMap API Key

// Define expected structure for Gemini response
interface PreservationGuide {
  storageLocation: string;
  temperatureRange: string;
  humidityLevel: string;
  containerType: string;
  preparationSteps?: string[];
  estimatedShelfLife: string;
  additionalTips?: string[];
}

type LoadingState = 'idle' | 'loading-location' | 'loading-weather' | 'loading-guide' | 'success' | 'error';

const PreserveGuide = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const foodType = location.state?.foodType || 'this food item'; // Get foodType from navigation state

  const [guide, setGuide] = useState<PreservationGuide | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchPreservationGuide = async () => {
      if (!GEMINI_API_KEY) {
        setErrorMessage('Gemini API key is missing. Please check your environment variables.');
        setLoadingState('error');
        return;
      }
      if (!WEATHER_API_KEY) {
        setErrorMessage('Weather API key is missing.');
        setLoadingState('error');
        return;
      }

      setErrorMessage(null);
      setGuide(null);
      setLoadingState('loading-location');

      let latitude: number | null = null;
      let longitude: number | null = null;
      let weatherData: { temperature: number | null; humidity: number | null; description: string } | null = null;

      try {
        // 1. Try Geolocation API
        if (!navigator.geolocation) {
          throw new Error('Browser Geolocation API not available.'); // More specific error
        }

        console.log('Attempting to get location via Geolocation API...');
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        console.log('Geolocation API success:', latitude, longitude);

        // 2. Get Weather using Geolocation coords
        setLoadingState('loading-weather');
        console.log('Fetching weather using Geolocation coords...');
        const weatherResponse = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${WEATHER_API_KEY}&units=metric`
        );
        if (!weatherResponse.ok) {
          const weatherError = await weatherResponse.json();
          throw new Error(`Failed to fetch weather (GeoCoords): ${weatherError.message || 'Unknown error'}`);
        }
        const rawWeatherData = await weatherResponse.json();
        weatherData = {
          description: rawWeatherData.weather?.[0]?.description || 'Not available',
          temperature: rawWeatherData.main?.temp ?? null,
          humidity: rawWeatherData.main?.humidity ?? null,
        };
        console.log('Weather fetch (GeoCoords) success:', weatherData);

      } catch (error) {
        console.warn('Initial Geolocation/Weather fetch failed:', error);

        // Check if it was a Geolocation Permission or Availability error
        if (typeof error === 'object' && error !== null && typeof (error as any).code === 'number' && ((error as any).code === 1 || (error as any).code === 2)) {
          console.log('Geolocation failed (Permission/Unavailable), attempting IP fallback...');
          setLoadingState('loading-weather'); // Indicate loading fallback weather
          try {
            // Call the backend endpoint for IP-based weather
            const apiUrl = process.env.NODE_ENV === 'production'
                ? 'https://food-backend-6yql.onrender.com' // Use Render URL in production
                : 'http://localhost:5000'; // Use local URL in development (Ensure backend is running)

            console.log(`Fetching weather via IP from backend: ${apiUrl}/get_ip_weather`);
            const ipWeatherResponse = await fetch(`${apiUrl}/get_ip_weather`);

            if (!ipWeatherResponse.ok) {
                const ipWeatherError = await ipWeatherResponse.json().catch(() => ({ error: 'Unknown backend error' }));
                throw new Error(`Failed to fetch weather via IP: ${ipWeatherError.error || ipWeatherResponse.statusText}`);
            }
            const ipWeatherData = await ipWeatherResponse.json();
            weatherData = {
                description: ipWeatherData.description || 'Not available',
                temperature: ipWeatherData.temperature ?? null,
                humidity: ipWeatherData.humidity ?? null,
            };
             console.log('Weather fetch (IP Fallback) success:', weatherData);

          } catch (fallbackError) {
            console.error('IP Weather fallback failed:', fallbackError);
            const message = fallbackError instanceof Error ? fallbackError.message : 'An unknown error occurred during IP weather fallback.';
            setErrorMessage(message);
            setLoadingState('error');
            return; // Stop execution if fallback fails
          }
        } else {
          // Handle other errors (Timeout, standard JS errors, etc.)
          console.error('Non-geolocation or non-fallback error:', error);
          let specificMessage = 'An unknown error occurred while preparing the guide.';
          if (error instanceof Error) {
             specificMessage = error.message;
          } else if (typeof error === 'object' && error !== null && typeof (error as any).code === 'number' && (error as any).code === 3) {
             specificMessage = 'Failed to get location within the time limit. Please check your network connection or try again later.';
          } else {
             try {
                specificMessage = `Non-standard error: ${JSON.stringify(error)}`;
             } catch (_) {
                specificMessage = 'Caught a non-standard error that could not be stringified.';
             }
          }
          setErrorMessage(specificMessage);
          setLoadingState('error');
          return; // Stop execution
        }
      }

      // 3. Proceed to Gemini if weather data was obtained (either method)
      if (weatherData) {
        try {
          setLoadingState('loading-guide');
          console.log('Calling Gemini with weather:', weatherData);
          const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
          const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

          const generationConfig = {
              temperature: 0.6,
              topK: 64,
              topP: 0.95,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json',
          };
          const safetySettings = [
              { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
              { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
              { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
              { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
          ];

          const prompt = `Provide a detailed food preservation guide for ${foodType}. The current weather is ${weatherData.description} with a temperature of ${weatherData.temperature ?? 'N/A'}°C and humidity of ${weatherData.humidity ?? 'N/A'}%. Focus on practical steps to prevent spoilage in the near future based on these conditions. Structure the response as a JSON object with the following keys strictly: "storageLocation" (string), "temperatureRange" (string), "humidityLevel" (string), "containerType" (string), "preparationSteps" (optional array of strings), "estimatedShelfLife" (string), "additionalTips" (optional array of strings). Only return the JSON object.`;

          const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig, safetySettings });
          const responseText = result.response.text();

          let parsedGuide: PreservationGuide;
          try {
              parsedGuide = JSON.parse(responseText);
          } catch (parseError) {
              console.error('Failed to parse Gemini response as JSON:', responseText);
              throw new Error('AI failed to generate the guide in the expected format. Please try again.');
          }

          setGuide(parsedGuide);
          setLoadingState('success');
          console.log('Gemini guide generation successful.');

        } catch (geminiError) {
            console.error('Gemini guide generation failed:', geminiError);
            const message = geminiError instanceof Error ? geminiError.message : 'An unknown error occurred while generating the AI guide.';
            setErrorMessage(message);
            setLoadingState('error');
        }
      } else if (loadingState !== 'error') {
          // Should not happen if logic is correct, but as a safeguard
          console.error('Reached end of fetch function without weather data or error state.')
          setErrorMessage('Could not obtain weather data to generate guide.');
          setLoadingState('error');
      }
    };

    fetchPreservationGuide();
  }, [foodType]);

  const renderLoading = () => {
    let message = 'Initializing...';
    if (loadingState === 'loading-location') message = 'Getting your location...';
    if (loadingState === 'loading-weather') message = 'Fetching local weather data...';
    if (loadingState === 'loading-guide') message = 'Generating preservation tips with AI...';

    return (
      <div className="flex flex-col items-center justify-center space-y-4 p-8">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        <p className="text-lg text-gray-700">{message}</p>
      </div>
    );
  };

  const renderError = () => (
    <Alert variant="destructive" className="m-4">
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        {errorMessage || 'Failed to generate preservation guide. Please try again later.'}
      </AlertDescription>
      <Button onClick={() => navigate('/')} variant="secondary" className="mt-4">Go Back</Button>
    </Alert>
  );

  const renderGuide = () => {
    if (!guide) return null;
    return (
      <Card className="m-4 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Preservation Guide for {foodType}</CardTitle>
          <CardDescription>Based on your current location and weather.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold">Storage Location:</h3>
            <p>{guide.storageLocation}</p>
          </div>
          <div>
            <h3 className="font-semibold">Ideal Temperature:</h3>
            <p>{guide.temperatureRange}</p>
          </div>
          <div>
            <h3 className="font-semibold">Ideal Humidity:</h3>
            <p>{guide.humidityLevel}</p>
          </div>
          <div>
            <h3 className="font-semibold">Recommended Container:</h3>
            <p>{guide.containerType}</p>
          </div>
          {guide.preparationSteps && guide.preparationSteps.length > 0 && (
            <div>
              <h3 className="font-semibold">Preparation Before Storing:</h3>
              <ul className="list-disc list-inside pl-4">
                {guide.preparationSteps.map((step, index) => <li key={index}>{step}</li>)}
              </ul>
            </div>
          )}
          <div>
            <h3 className="font-semibold">Estimated Shelf Life (with these methods):</h3>
            <p>{guide.estimatedShelfLife}</p>
          </div>
          {guide.additionalTips && guide.additionalTips.length > 0 && (
            <div>
              <h3 className="font-semibold">Additional Tips:</h3>
              <ul className="list-disc list-inside pl-4">
                {guide.additionalTips.map((tip, index) => <li key={index}>{tip}</li>)}
              </ul>
            </div>
          )}
          <div className="pt-4">
             <Button onClick={() => navigate('/')} variant="outline">Back to Detector</Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 py-8">
       <div className="container mx-auto max-w-3xl">
         {loadingState !== 'idle' && loadingState !== 'success' && loadingState !== 'error' && renderLoading()}
         {loadingState === 'error' && renderError()}
         {loadingState === 'success' && renderGuide()}
       </div>
    </div>
  );
};

export default PreserveGuide; 