#!/usr/bin/env python3
import cv2
import numpy as np
from PIL import Image
import sys
import json
import os

def apply_clahe_processing(input_path, output_path, clip_limit=2.0, tile_grid_size=8):
    """
    Apply CLAHE processing to an image using OpenCV
    """
    try:
        # Load image
        image = cv2.imread(input_path)
        if image is None:
            raise ValueError(f"Could not load image from {input_path}")
        
        # Convert to LAB color space
        lab_image = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        
        # Create CLAHE object
        clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile_grid_size, tile_grid_size))
        
        # Apply CLAHE to L channel only
        lab_image[:, :, 0] = clahe.apply(lab_image[:, :, 0])
        
        # Convert back to BGR
        result = cv2.cvtColor(lab_image, cv2.COLOR_LAB2BGR)
        
        # Save processed image
        cv2.imwrite(output_path, result)
        
        # Calculate quality metrics
        original_metrics = calculate_metrics(image)
        processed_metrics = calculate_metrics(result)
        
        return {
            "success": True,
            "output_path": output_path,
            "original_metrics": original_metrics,
            "processed_metrics": processed_metrics,
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

def calculate_metrics(image):
    """Calculate brightness and contrast metrics"""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    brightness = np.mean(gray)
    contrast = np.std(gray)
    return {
        "brightness": float(brightness),
        "contrast": float(contrast)
    }

def main():
    if len(sys.argv) != 6:
        print(json.dumps({
            "success": False,
            "error": "Usage: python clahe_processor.py <input_path> <output_path> <clip_limit> <tile_grid_size>"
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