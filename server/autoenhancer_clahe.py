#!/usr/bin/env python3
"""
AutoImageEnhancer CLAHE Implementation
Implementación exacta del repositorio AutoImageEnhancer usando cv2.createCLAHE()
"""

import cv2
import numpy as np
import sys
import os
import json
from PIL import Image

def apply_clahe(image, clip_limit=2.0, tile_grid_size=8):
    """
    Apply Contrast Limited Adaptive Histogram Equalization (CLAHE)
    COPIA EXACTA del código funcionando en clahe_app.py
    """
    # Convert PIL image to OpenCV format
    cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    
    # Convert to LAB color space
    lab_image = cv2.cvtColor(cv_image, cv2.COLOR_BGR2LAB)
    
    # Apply CLAHE to L channel
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile_grid_size, tile_grid_size))
    lab_image[:, :, 0] = clahe.apply(lab_image[:, :, 0])
    
    # Convert back to BGR and then to RGB
    corrected_bgr = cv2.cvtColor(lab_image, cv2.COLOR_LAB2BGR)
    corrected_rgb = cv2.cvtColor(corrected_bgr, cv2.COLOR_BGR2RGB)
    
    return Image.fromarray(corrected_rgb)

def calculate_metrics(image):
    """Calculate brightness and contrast metrics"""
    # Convert to numpy array if it's a PIL image
    if hasattr(image, 'mode'):
        img_array = np.array(image)
    else:
        img_array = image
    
    # Convert to grayscale for metrics calculation
    if len(img_array.shape) == 3:
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    else:
        gray = img_array.astype(np.float64)
    
    # Ensure gray is a numpy array
    gray = np.asarray(gray, dtype=np.float64)
    
    # Calculate brightness (mean pixel value)
    brightness = float(np.mean(gray))
    
    # Calculate contrast (standard deviation)
    contrast = float(np.std(gray))
    
    return {
        'brightness': brightness,
        'contrast': contrast
    }

def apply_clahe_processing(input_path, output_path, clip_limit=2.0, tile_grid_size=8):
    """
    Apply CLAHE processing to an image using the exact AutoImageEnhancer algorithm
    """
    try:
        # Load image
        image = Image.open(input_path)
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Calculate original metrics
        original_metrics = calculate_metrics(image)
        
        # Apply CLAHE using the exact AutoImageEnhancer implementation
        processed_image = apply_clahe(image, clip_limit, tile_grid_size)
        
        # Calculate processed metrics
        processed_metrics = calculate_metrics(processed_image)
        
        # Save processed image
        processed_image.save(output_path, format='PNG', quality=95)
        
        return {
            'success': True,
            'original_metrics': original_metrics,
            'processed_metrics': processed_metrics,
            'output_path': output_path
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def main():
    if len(sys.argv) != 3:
        result = {
            'success': False,
            'error': 'Usage: python autoenhancer_clahe.py <input_path> <output_path>'
        }
        print(json.dumps(result))
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    # Use default AutoImageEnhancer parameters
    clip_limit = 2.0
    tile_grid_size = 8
    
    result = apply_clahe_processing(input_path, output_path, clip_limit, tile_grid_size)
    
    # Output JSON for Node.js consumption
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()