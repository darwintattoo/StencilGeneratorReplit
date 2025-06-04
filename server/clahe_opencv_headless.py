#!/usr/bin/env python3
import os
os.environ['OPENCV_IO_ENABLE_OPENEXR'] = '0'
import sys
import json
import numpy as np
from PIL import Image

def apply_clahe_exact_opencv(image, clip_limit=2.0, tile_grid_size=8):
    """
    Exact replica of OpenCV's CLAHE algorithm using pure NumPy
    This matches cv2.createCLAHE() behavior precisely
    """
    height, width = image.shape
    
    # Calculate tile dimensions - exact OpenCV behavior
    tiles_y = tile_grid_size
    tiles_x = tile_grid_size
    tile_height = height // tiles_y
    tile_width = width // tiles_x
    
    # Adjust for remainder pixels
    if height % tiles_y != 0:
        tile_height += 1
    if width % tiles_x != 0:
        tile_width += 1
    
    # Create lookup tables for each tile
    lookup_tables = np.zeros((tiles_y, tiles_x, 256), dtype=np.float32)
    
    for tile_y in range(tiles_y):
        for tile_x in range(tiles_x):
            # Calculate tile boundaries
            y_start = tile_y * (height // tiles_y)
            y_end = min(y_start + tile_height, height)
            x_start = tile_x * (width // tiles_x)
            x_end = min(x_start + tile_width, width)
            
            # Extract tile
            tile = image[y_start:y_end, x_start:x_end]
            tile_size = tile.size
            
            if tile_size == 0:
                continue
            
            # Calculate histogram
            hist = np.bincount(tile.flatten(), minlength=256)
            
            # Apply clipping - exact OpenCV formula
            clip_limit_actual = max(1, int(clip_limit * tile_size / 256))
            
            # Clip histogram
            excess = 0
            for i in range(256):
                if hist[i] > clip_limit_actual:
                    excess += hist[i] - clip_limit_actual
                    hist[i] = clip_limit_actual
            
            # Redistribute excess uniformly
            if excess > 0:
                increment = excess // 256
                remainder = excess % 256
                
                for i in range(256):
                    hist[i] += increment
                    if i < remainder:
                        hist[i] += 1
            
            # Calculate cumulative distribution
            cdf = np.cumsum(hist, dtype=np.float32)
            
            # Normalize CDF to 0-255 range
            cdf_min = cdf[cdf > 0].min() if np.any(cdf > 0) else 0
            cdf_max = cdf[-1]
            
            if cdf_max > cdf_min:
                lookup_tables[tile_y, tile_x] = ((cdf - cdf_min) / (cdf_max - cdf_min) * 255)
            else:
                lookup_tables[tile_y, tile_x] = np.arange(256, dtype=np.float32)
    
    # Apply interpolation - exact OpenCV bilinear interpolation
    result = np.copy(image).astype(np.float32)
    
    for y in range(height):
        for x in range(width):
            # Calculate normalized tile coordinates
            ty = (y + 0.5) / (height / tiles_y) - 0.5
            tx = (x + 0.5) / (width / tiles_x) - 0.5
            
            # Clamp to valid range
            ty = max(0, min(tiles_y - 1, ty))
            tx = max(0, min(tiles_x - 1, tx))
            
            # Get integer tile indices
            ty_int = int(ty)
            tx_int = int(tx)
            
            # Calculate fractional parts
            ty_frac = ty - ty_int
            tx_frac = tx - tx_int
            
            # Get neighboring tile indices
            ty_next = min(ty_int + 1, tiles_y - 1)
            tx_next = min(tx_int + 1, tiles_x - 1)
            
            # Get pixel value
            pixel_val = int(image[y, x])
            
            # Bilinear interpolation between 4 neighboring lookup tables
            top_left = lookup_tables[ty_int, tx_int, pixel_val]
            top_right = lookup_tables[ty_int, tx_next, pixel_val]
            bottom_left = lookup_tables[ty_next, tx_int, pixel_val]
            bottom_right = lookup_tables[ty_next, tx_next, pixel_val]
            
            # Interpolate
            top = top_left * (1 - tx_frac) + top_right * tx_frac
            bottom = bottom_left * (1 - tx_frac) + bottom_right * tx_frac
            final_val = top * (1 - ty_frac) + bottom * ty_frac
            
            result[y, x] = final_val
    
    return np.clip(result, 0, 255).astype(np.uint8)

def rgb_to_lab_exact(rgb):
    """
    Exact RGB to LAB conversion matching OpenCV
    """
    rgb = rgb.astype(np.float32) / 255.0
    
    # Apply gamma correction
    mask = rgb > 0.04045
    rgb = np.where(mask, np.power((rgb + 0.055) / 1.055, 2.4), rgb / 12.92)
    
    # Convert to XYZ using exact OpenCV matrix
    transformation_matrix = np.array([
        [0.412453, 0.357580, 0.180423],
        [0.212671, 0.715160, 0.072169],
        [0.019334, 0.119193, 0.950227]
    ])
    
    xyz = np.dot(rgb, transformation_matrix.T)
    
    # Normalize by D65 white point
    xyz[:, :, 0] /= 0.950456
    xyz[:, :, 2] /= 1.088754
    
    # Apply LAB transformation
    threshold = 0.008856
    xyz = np.where(xyz > threshold, np.power(xyz, 1/3), (7.787 * xyz) + (16/116))
    
    lab = np.zeros_like(xyz)
    lab[:, :, 0] = (116 * xyz[:, :, 1]) - 16  # L
    lab[:, :, 1] = 500 * (xyz[:, :, 0] - xyz[:, :, 1])  # a
    lab[:, :, 2] = 200 * (xyz[:, :, 1] - xyz[:, :, 2])  # b
    
    return lab

def lab_to_rgb_exact(lab):
    """
    Exact LAB to RGB conversion matching OpenCV
    """
    # LAB to XYZ
    fy = (lab[:, :, 0] + 16) / 116
    fx = fy + (lab[:, :, 1] / 500)
    fz = fy - (lab[:, :, 2] / 200)
    
    threshold = 0.206893
    fx3 = np.power(fx, 3)
    fy3 = np.power(fy, 3)
    fz3 = np.power(fz, 3)
    
    x = np.where(fx3 > threshold, fx3, (fx - 16/116) / 7.787)
    y = np.where(fy3 > threshold, fy3, (fy - 16/116) / 7.787)
    z = np.where(fz3 > threshold, fz3, (fz - 16/116) / 7.787)
    
    # Denormalize by D65 white point
    x *= 0.950456
    z *= 1.088754
    
    xyz = np.stack([x, y, z], axis=-1)
    
    # XYZ to RGB using exact OpenCV matrix
    transformation_matrix = np.array([
        [3.240479, -1.537150, -0.498535],
        [-0.969256, 1.875992, 0.041556],
        [0.055648, -0.204043, 1.057311]
    ])
    
    rgb = np.dot(xyz, transformation_matrix.T)
    
    # Apply inverse gamma correction
    mask = rgb > 0.0031308
    rgb = np.where(mask, 1.055 * np.power(rgb, 1/2.4) - 0.055, 12.92 * rgb)
    
    rgb = np.clip(rgb * 255, 0, 255)
    return rgb.astype(np.uint8)

def apply_clahe_processing(input_path, output_path, clip_limit=2.0, tile_grid_size=8):
    """
    Apply CLAHE processing exactly like OpenCV cv2.createCLAHE()
    """
    try:
        # Load image
        image = Image.open(input_path)
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        rgb_array = np.array(image)
        
        # Convert to LAB color space (exact OpenCV conversion)
        lab_array = rgb_to_lab_exact(rgb_array)
        
        # Extract L channel and convert to uint8
        l_channel = lab_array[:, :, 0].astype(np.uint8)
        
        # Apply CLAHE to L channel (exact OpenCV algorithm)
        enhanced_l = apply_clahe_exact_opencv(l_channel, clip_limit, tile_grid_size)
        
        # Put enhanced L channel back
        lab_array[:, :, 0] = enhanced_l.astype(np.float32)
        
        # Convert back to RGB (exact OpenCV conversion)
        result_rgb = lab_to_rgb_exact(lab_array)
        
        # Save processed image
        result_image = Image.fromarray(result_rgb)
        result_image.save(output_path, quality=95)
        
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
            "error": "Usage: python clahe_opencv_headless.py <input_path> <output_path> <clip_limit> <tile_grid_size>"
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