# backend/app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
from PIL import Image
import io
import os
from ultralytics import YOLO  # Import YOLO
import requests # Import requests

os.environ["CUDA_VISIBLE_DEVICES"] = "-1"

app = Flask(__name__)
CORS(app, origins=['https://food-backend-6yql.onrender.com', 'http://localhost:8080', 'https://food-frontend-sandy.vercel.app', 'https://food-frontend-mocha.vercel.app', 'https://localhost:8080']) # Added https localhost

# Load the trained models
cnn_model = tf.keras.models.load_model("models/model.h5", compile=False)
yolo_model = YOLO("best.pt") # Load YOLO model

# CNN Class labels
cnn_class_labels = [
    'orange_rotten',
    'orange_fresh',
    'orange_medium_fresh',
    'tomato_rotten',
    'tomato_fresh',
    'tomato_medium_fresh',
    'carrot_rotten',
    'carrot_fresh',
    'carrot_medium_fresh'
]

# YOLO Class labels - **IMPORTANT**: Verify this order matches your model's output index order!
yolo_class_labels = [
    "Fresh Apple",
    "Fresh Banana",
    "Fresh Capsicum",
    "Fresh Orange",
    "Fresh Potato",
    "FreshBittergourd", # Assuming this is one class based on spacing
    "Fruits-Vegetables", # Consider if you want to handle this general class
    "Spoiled Apple",
    "Spoiled Banana",
    "Spoiled Bittergourd",
    "Spoiled Capsicum",
    "Spoiled Orange",
    "Spoiled Potato"
]

# Map YOLO numerical class IDs to labels if needed (Example)
# yolo_class_map = { 0: 'orange_fresh', 1: 'orange_medium_fresh', ... }
# You'll need to create this map based on your YOLO model's training.

# API Keys (Consider moving to environment variables)
IPINFO_TOKEN = '1fe330aba4c705'
OPENWEATHERMAP_API_KEY = '83545c5eda2941881cc4b48edafb9360'

def preprocess_image_cnn(image_bytes):
    """Preprocesses the image for CNN prediction."""
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image = image.resize((224, 224))
    image = np.array(image) / 255.0
    image = np.expand_dims(image, axis=0)
    return image

# No specific preprocessing needed for YOLO ultralytics library, it handles it.
# Just need the image object or path.

@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400

    model_type = request.form.get('model_type', 'cnn') # Default to CNN if not provided
    image_bytes = request.files['image'].read()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB") # YOLO needs PIL image or path

    if model_type == 'yolo':
        try:
            results = yolo_model(image) # Perform YOLO prediction

            if results and results[0].boxes:
                # Sort detections by confidence and pick the highest one
                sorted_boxes = sorted(results[0].boxes, key=lambda x: x.conf, reverse=True)
                best_result = sorted_boxes[0]

                predicted_index = int(best_result.cls)
                confidence = float(best_result.conf)

                # Get the label string from the correct list based on the index
                if predicted_index < len(yolo_class_labels):
                     predicted_class = yolo_class_labels[predicted_index]
                     # Handle the general 'Fruits-Vegetables' class if needed
                     if predicted_class == "Fruits-Vegetables":
                         # Option 1: Treat as uncertain or a specific category
                         # Option 2: Try to get the second-best prediction if available
                         # For now, let's just return it as is, frontend needs to handle
                         pass
                else:
                     # Index out of bounds, indicates a mismatch between model output and label list
                     print(f"Error: YOLO predicted index {predicted_index} which is out of bounds for yolo_class_labels (len={len(yolo_class_labels)})!")
                     predicted_class = "Unknown YOLO Class"
                     confidence = 0.0 # Set confidence low for unknown class


                return jsonify({
                    'predicted_class': predicted_class,
                    'confidence': confidence,
                    'model_used': 'yolo'
                })
            else:
                return jsonify({'error': 'No objects detected by YOLO'}), 404
        except Exception as e:
             # Log the exception for debugging
             app.logger.error(f"Error during YOLO prediction: {e}", exc_info=True)
             return jsonify({'error': 'YOLO prediction failed'}), 500

    elif model_type == 'cnn':
        try:
            processed_cnn = preprocess_image_cnn(image_bytes)
            predictions = cnn_model.predict(processed_cnn)
            predicted_index = int(np.argmax(predictions, axis=1)[0])
            confidence = float(np.max(predictions))

            # Get the label string from the CNN list
            if predicted_index < len(cnn_class_labels):
                 predicted_class = cnn_class_labels[predicted_index]
            else:
                 print(f"Error: CNN predicted index {predicted_index} which is out of bounds for cnn_class_labels (len={len(cnn_class_labels)})!")
                 predicted_class = "Unknown CNN Class"
                 confidence = 0.0

            return jsonify({
                'predicted_class': predicted_class, # Use the actual label string
                'confidence': confidence,
                'model_used': 'cnn'
            })
        except Exception as e:
            app.logger.error(f"Error during CNN prediction: {e}", exc_info=True)
            return jsonify({'error': 'CNN prediction failed'}), 500
    else:
        return jsonify({'error': 'Invalid model type specified'}), 400

@app.route('/get_ip_weather', methods=['GET'])
def get_ip_weather():
    # Get client IP address - handle proxies if necessary
    if request.headers.getlist("X-Forwarded-For"):
       ip_address = request.headers.getlist("X-Forwarded-For")[0].split(',')[0]
    else:
       ip_address = request.remote_addr

    # Fallback for localhost testing (ipinfo doesn't work with 127.0.0.1)
    if ip_address == '127.0.0.1':
        ip_address = '' # Let ipinfo use its default (server location)

    app.logger.info(f"Fetching location for IP: {ip_address or 'server default'}")

    try:
        # 1. Get Location from IP using ipinfo.io
        ipinfo_url = f"https://ipinfo.io/{ip_address}?token={IPINFO_TOKEN}"
        ip_response = requests.get(ipinfo_url, timeout=5) # Add timeout
        ip_response.raise_for_status() # Raise exception for bad status codes
        location_data = ip_response.json()

        lat, lon = None, None
        if 'loc' in location_data:
            lat_str, lon_str = location_data['loc'].split(',')
            lat, lon = float(lat_str), float(lon_str)
            app.logger.info(f"IP Location (lat/lon): {lat}, {lon}")
        elif 'city' in location_data:
            # Fallback to city if lat/lon not precise
            city = location_data['city']
            app.logger.info(f"IP Location (city): {city}")
            # Prepare OpenWeatherMap URL for city query
            weather_url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={OPENWEATHERMAP_API_KEY}&units=metric"
        else:
             raise ValueError("Could not determine location from IPinfo response.")

        # Prepare OpenWeatherMap URL if lat/lon found
        if lat is not None and lon is not None:
             weather_url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={OPENWEATHERMAP_API_KEY}&units=metric"

        # 2. Get Weather from OpenWeatherMap
        app.logger.info(f"Fetching weather from: {weather_url}")
        weather_response = requests.get(weather_url, timeout=5) # Add timeout
        weather_response.raise_for_status()
        weather_data = weather_response.json()

        weather_description = weather_data.get('weather', [{}])[0].get('description', 'Not available')
        temperature = weather_data.get('main', {}).get('temp', None)
        humidity = weather_data.get('main', {}).get('humidity', None)

        app.logger.info(f"Weather fetched: Desc={weather_description}, Temp={temperature}, Humidity={humidity}")

        return jsonify({
            'temperature': temperature,
            'humidity': humidity,
            'description': weather_description
        })

    except requests.exceptions.RequestException as e:
        app.logger.error(f"API request failed: {e}")
        return jsonify({'error': f'Failed to contact external service: {e.__class__.__name__}'}), 503 # Service Unavailable
    except ValueError as e:
        app.logger.error(f"Data processing error: {e}")
        return jsonify({'error': f'Could not process location data: {e}'}), 500
    except Exception as e:
        app.logger.error(f"Unexpected error in /get_ip_weather: {e}", exc_info=True)
        return jsonify({'error': 'An internal server error occurred'}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    # Use host='0.0.0.0' to make it accessible externally if needed,
    # but keep debug=False for production/deployment.
    # For local testing, debug=True is fine.
    app.run(host='0.0.0.0', port=port, debug=True) # Changed host for potential container use
