#!/usr/bin/env python3
import os
os.environ['OPENCV_IO_ENABLE_OPENEXR'] = '0'
import cv2
import numpy as np
from PIL import Image
import sys
import json

def apply_clahe(image, clip_limit=2.0, tile_grid_size=8):
    """
    Apply Contrast Limited Adaptive Histogram Equalization (CLAHE)
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

def apply_clahe_processing(input_path, output_path, clip_limit=2.0, tile_grid_size=8):
    """
    Apply CLAHE processing to an image using the exact same code that works in Streamlit
    """
    try:
        # Load image
        image = Image.open(input_path)
        
        # Ensure image is in RGB mode
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Process image using CLAHE with optimal parameters
        processed_image = apply_clahe(image, clip_limit, tile_grid_size)
        
        # Save processed image
        processed_image.save(output_path, quality=95)
        
        # Calculate quality metrics
        original_array = np.array(image)
        processed_array = np.array(processed_image)
        
        # Calculate mean brightness
        original_brightness = np.mean(original_array)
        processed_brightness = np.mean(processed_array)
        
        # Calculate standard deviation (contrast measure)
        original_contrast = np.std(original_array)
        processed_contrast = np.std(processed_array)
        
        return {
            "success": True,
            "output_path": output_path,
            "original_metrics": {
                "brightness": float(original_brightness),
                "contrast": float(original_contrast)
            },
            "processed_metrics": {
                "brightness": float(processed_brightness),
                "contrast": float(processed_contrast)
            },
            "parameters": {
                "clip_limit": clip_limit,
                "tile_grid_size": tile_grid_size
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def main():
    if len(sys.argv) != 5:
        print(json.dumps({
            "success": False,
            "error": "Usage: python clahe_exact.py <input_path> <output_path> <clip_limit> <tile_grid_size>"
        }))
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    clip_limit = float(sys.argv[3])
    tile_grid_size = int(sys.argv[4])
    
    result = apply_clahe_processing(input_path, output_path, clip_limit, tile_grid_size)
    print(json.dumps(result))

if __name__ == "__main__":
    main()