#!/usr/bin/env python3
import numpy as np
from PIL import Image
import sys
import json
import os

def rgb_to_lab(rgb):
    """Convert RGB to LAB color space using numpy"""
    rgb = rgb / 255.0
    
    # Apply gamma correction
    mask = rgb > 0.04045
    rgb[mask] = np.power((rgb[mask] + 0.055) / 1.055, 2.4)
    rgb[~mask] = rgb[~mask] / 12.92
    
    # Convert to XYZ
    xyz = np.dot(rgb, np.array([[0.4124564, 0.3575761, 0.1804375],
                                [0.2126729, 0.7151522, 0.0721750],
                                [0.0193339, 0.1191920, 0.9503041]]))
    
    # Normalize by D65 illuminant
    xyz = xyz / np.array([0.95047, 1.0, 1.08883])
    
    # Apply lab transformation
    mask = xyz > 0.008856
    xyz[mask] = np.power(xyz[mask], 1/3)
    xyz[~mask] = (7.787 * xyz[~mask]) + (16/116)
    
    lab = np.zeros_like(xyz)
    lab[:, :, 0] = (116 * xyz[:, :, 1]) - 16  # L
    lab[:, :, 1] = 500 * (xyz[:, :, 0] - xyz[:, :, 1])  # a
    lab[:, :, 2] = 200 * (xyz[:, :, 1] - xyz[:, :, 2])  # b
    
    return lab

def lab_to_rgb(lab):
    """Convert LAB to RGB color space using numpy"""
    # LAB to XYZ
    fy = (lab[:, :, 0] + 16) / 116
    fx = fy + (lab[:, :, 1] / 500)
    fz = fy - (lab[:, :, 2] / 200)
    
    xyz = np.stack([fx, fy, fz], axis=-1)
    
    mask = xyz > 0.206893
    xyz[mask] = np.power(xyz[mask], 3)
    xyz[~mask] = (xyz[~mask] - 16/116) / 7.787
    
    # Denormalize by D65 illuminant
    xyz = xyz * np.array([0.95047, 1.0, 1.08883])
    
    # XYZ to RGB
    rgb = np.dot(xyz, np.array([[3.2404542, -1.5371385, -0.4985314],
                                [-0.9692660, 1.8760108, 0.0415560],
                                [0.0556434, -0.2040259, 1.0572252]]))
    
    # Apply inverse gamma correction
    mask = rgb > 0.0031308
    rgb[mask] = 1.055 * np.power(rgb[mask], 1/2.4) - 0.055
    rgb[~mask] = 12.92 * rgb[~mask]
    
    rgb = np.clip(rgb * 255, 0, 255)
    return rgb.astype(np.uint8)

def apply_clahe_numpy(image, clip_limit=2.0, tile_grid_size=8):
    """
    Apply CLAHE using pure numpy implementation
    """
    height, width = image.shape[:2]
    
    # Calculate tile dimensions
    tile_height = height // tile_grid_size
    tile_width = width // tile_grid_size
    
    # Create lookup tables for each tile
    lookup_tables = np.zeros((tile_grid_size, tile_grid_size, 256), dtype=np.uint8)
    
    for tile_y in range(tile_grid_size):
        for tile_x in range(tile_grid_size):
            # Extract tile
            start_y = tile_y * tile_height
            start_x = tile_x * tile_width
            end_y = min(start_y + tile_height, height)
            end_x = min(start_x + tile_width, width)
            
            tile = image[start_y:end_y, start_x:end_x]
            
            # Calculate histogram
            hist, _ = np.histogram(tile, bins=256, range=(0, 256))
            
            # Apply clipping
            clip_value = int((clip_limit * tile.size) / 256)
            excess = np.sum(np.maximum(hist - clip_value, 0))
            hist = np.minimum(hist, clip_value)
            
            # Redistribute excess
            redistribute_per_bin = excess // 256
            remainder = excess % 256
            hist += redistribute_per_bin
            hist[:remainder] += 1
            
            # Calculate CDF
            cdf = np.cumsum(hist)
            
            # Normalize CDF
            cdf_min = cdf[cdf > 0].min() if np.any(cdf > 0) else 0
            denominator = tile.size - cdf_min
            
            if denominator > 0:
                lookup_tables[tile_y, tile_x] = ((cdf - cdf_min) / denominator * 255).astype(np.uint8)
            else:
                lookup_tables[tile_y, tile_x] = np.arange(256, dtype=np.uint8)
    
    # Apply lookup tables with bilinear interpolation
    result = np.copy(image)
    
    for y in range(height):
        for x in range(width):
            # Calculate tile coordinates with offset centering
            ty = (y + 0.5) / tile_height - 0.5
            tx = (x + 0.5) / tile_width - 0.5
            
            # Get integer tile indices
            y_low = max(int(np.floor(ty)), 0)
            y_high = min(y_low + 1, tile_grid_size - 1)
            x_low = max(int(np.floor(tx)), 0)
            x_high = min(x_low + 1, tile_grid_size - 1)
            
            # Calculate interpolation weights
            wy = ty - y_low
            wx = tx - x_low
            
            # Get lookup values from four surrounding tiles
            original_val = image[y, x]
            l00 = lookup_tables[y_low, x_low, original_val]
            l10 = lookup_tables[y_low, x_high, original_val]
            l01 = lookup_tables[y_high, x_low, original_val]
            l11 = lookup_tables[y_high, x_high, original_val]
            
            # Bilinear interpolation
            new_val = (1 - wy) * ((1 - wx) * l00 + wx * l10) + wy * ((1 - wx) * l01 + wx * l11)
            result[y, x] = int(new_val)
    
    return result

def apply_clahe_processing(input_path, output_path, clip_limit=2.0, tile_grid_size=8):
    """
    Apply CLAHE processing to an image using numpy implementation
    """
    try:
        # Load image
        image = Image.open(input_path)
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        rgb_array = np.array(image)
        
        # Convert to LAB color space
        lab_array = rgb_to_lab(rgb_array.astype(np.float32))
        
        # Extract L channel (normalize to 0-255)
        l_channel = ((lab_array[:, :, 0] + 16) / 116 * 255).astype(np.uint8)
        
        # Apply CLAHE to L channel
        enhanced_l = apply_clahe_numpy(l_channel, clip_limit, tile_grid_size)
        
        # Put enhanced L channel back
        lab_array[:, :, 0] = (enhanced_l / 255.0 * 116) - 16
        
        # Convert back to RGB
        result_rgb = lab_to_rgb(lab_array)
        
        # Save processed image
        result_image = Image.fromarray(result_rgb)
        result_image.save(output_path)
        
        # Calculate quality metrics
        original_metrics = calculate_metrics(rgb_array)
        processed_metrics = calculate_metrics(result_rgb)
        
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
    if len(image.shape) == 3:
        gray = np.dot(image, [0.299, 0.587, 0.114])
    else:
        gray = image
    
    brightness = float(np.mean(gray))
    contrast = float(np.std(gray))
    
    return {
        "brightness": brightness,
        "contrast": contrast
    }

def main():
    if len(sys.argv) != 5:
        print(json.dumps({
            "success": False,
            "error": "Usage: python numpy_clahe.py <input_path> <output_path> <clip_limit> <tile_grid_size>"
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