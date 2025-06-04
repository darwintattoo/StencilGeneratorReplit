/**
 * CLAHE Configuration for ComfyDeploy
 * Implements the exact specifications requested:
 * 1. Histogram Equalization (YUV color space, Y channel)
 * 2. CLAHE (clip_limit=2.0, tile_grid_size=8x8, LAB color space)
 * 3. RGB Histogram Analysis
 * 4. Quality Metrics (brightness and contrast)
 */

export interface CLAHEProcessingConfig {
  // CLAHE Parameters
  apply_clahe: boolean;
  clahe_clip_limit: number;
  clahe_tile_grid_size: number;
  clahe_color_space: string;
  
  // Histogram Equalization Parameters
  apply_yuv_equalization: boolean;
  yuv_preserve_color: boolean;
  yuv_channel_target: string;
  
  // RGB Analysis Parameters
  generate_rgb_histograms: boolean;
  histogram_analysis_enabled: boolean;
  rgb_channel_separation: boolean;
  
  // Quality Metrics Parameters
  calculate_brightness_metrics: boolean;
  calculate_contrast_metrics: boolean;
  quality_comparison_mode: boolean;
}

/**
 * Generate optimal CLAHE configuration
 * Uses the exact parameters specified: clip_limit=2.0, grid_size=8x8, LAB color space
 */
export function generateCLAHEConfig(enabled: boolean = true): CLAHEProcessingConfig {
  return {
    // CLAHE - Contrast Limited Adaptive Histogram Equalization
    apply_clahe: enabled,
    clahe_clip_limit: 2.0,
    clahe_tile_grid_size: 8,
    clahe_color_space: "LAB",
    
    // Histogram Equalization (YUV color space, Y channel)
    apply_yuv_equalization: enabled,
    yuv_preserve_color: true,
    yuv_channel_target: "Y",
    
    // RGB Histogram Analysis
    generate_rgb_histograms: enabled,
    histogram_analysis_enabled: enabled,
    rgb_channel_separation: enabled,
    
    // Quality Metrics
    calculate_brightness_metrics: enabled,
    calculate_contrast_metrics: enabled,
    quality_comparison_mode: enabled
  };
}