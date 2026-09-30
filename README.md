# FreshSense

FreshSense is a web app that tells you whether fruits and vegetables are fresh, partially fresh, or spoiled — just from a photo.

The idea is simple: instead of guessing whether that tomato or orange in your kitchen is still good, you take a picture and let the app check for you. You upload or capture an image of the produce, and it's sent to a backend service running trained AI models. These models have learned to recognize the visual signs of freshness and spoilage — things like color changes, texture, and surface damage — across items like apples, bananas, oranges, tomatoes, carrots, potatoes, capsicum, and a few others.

Two different AI approaches work together behind the scenes: one model classifies a single item's freshness level, while the other can detect and identify produce within a photo before judging its condition. Once the image is processed, the app returns a clear result — showing which item was detected and how confident it is in the freshness prediction.

The result is a quick, practical tool aimed at reducing food waste and helping people make better decisions about what to eat, cook, or throw out — no manual inspection or guesswork required. The frontend is a clean, responsive web interface built for ease of use, while the backend handles the heavier lifting of image processing and AI inference.
