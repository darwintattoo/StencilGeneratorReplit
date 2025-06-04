import streamlit as st
import cv2
import numpy as np
from PIL import Image
import io
import base64
import tempfile
import os

def apply_clahe_opencv(image, clip_limit=2.0, tile_grid_size=8):
    """
    Apply CLAHE using OpenCV's native implementation
    """
    # Convert PIL image to OpenCV format
    cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    
    # Convert to LAB color space
    lab_image = cv2.cvtColor(cv_image, cv2.COLOR_BGR2LAB)
    
    # Create CLAHE object
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile_grid_size, tile_grid_size))
    
    # Apply CLAHE to L channel only
    lab_image[:, :, 0] = clahe.apply(lab_image[:, :, 0])
    
    # Convert back to BGR then RGB
    corrected_bgr = cv2.cvtColor(lab_image, cv2.COLOR_LAB2BGR)
    corrected_rgb = cv2.cvtColor(corrected_bgr, cv2.COLOR_BGR2RGB)
    
    return Image.fromarray(corrected_rgb)

def calculate_metrics(image):
    """Calculate brightness and contrast metrics"""
    img_array = np.array(image)
    
    # Calculate mean brightness
    brightness = np.mean(img_array)
    
    # Calculate standard deviation (contrast measure)
    contrast = np.std(img_array)
    
    return brightness, contrast

def create_download_link(image, filename):
    """Create a download link for the processed image"""
    img_buffer = io.BytesIO()
    image.save(img_buffer, format='PNG')
    img_buffer.seek(0)
    
    return st.download_button(
        label="📥 Download Enhanced Image",
        data=img_buffer.getvalue(),
        file_name=filename,
        mime="image/png"
    )

def main():
    st.set_page_config(
        page_title="CLAHE Image Enhancement - TattooStencilPro",
        page_icon="🎨",
        layout="wide"
    )
    
    st.title("🎨 CLAHE Image Enhancement")
    st.markdown("**TattooStencilPro by Darwin Enriquez** - Professional tattoo stencil image enhancement using OpenCV CLAHE algorithm")
    
    # Sidebar controls
    st.sidebar.header("CLAHE Parameters")
    clip_limit = st.sidebar.slider(
        "Clip Limit",
        min_value=1.0,
        max_value=10.0,
        value=2.0,
        step=0.1,
        help="Controls the contrast enhancement intensity. Higher values = more contrast."
    )
    
    tile_grid_size = st.sidebar.selectbox(
        "Tile Grid Size",
        options=[4, 6, 8, 10, 12, 16],
        index=2,  # Default to 8
        help="Size of the contextual regions. Smaller = more local adaptation."
    )
    
    # Reset button
    if st.sidebar.button("🔄 Reset to Optimal (2.0, 8x8)"):
        st.rerun()
    
    # File uploader
    uploaded_file = st.file_uploader(
        "Choose an image file",
        type=['jpg', 'jpeg', 'png', 'bmp', 'tiff'],
        help="Supported formats: JPEG, PNG, BMP, TIFF"
    )
    
    if uploaded_file is not None:
        try:
            # Load and display original image
            original_image = Image.open(uploaded_file)
            
            # Ensure image is in RGB mode
            if original_image.mode != 'RGB':
                original_image = original_image.convert('RGB')
            
            st.success("✅ Image uploaded successfully!")
            
            # Display image info
            st.sidebar.markdown("### 📊 Image Information")
            st.sidebar.markdown(f"**Filename:** {uploaded_file.name}")
            st.sidebar.markdown(f"**Size:** {original_image.size[0]} × {original_image.size[1]} pixels")
            st.sidebar.markdown(f"**Mode:** {original_image.mode}")
            st.sidebar.markdown(f"**File size:** {len(uploaded_file.getvalue()) / 1024:.1f} KB")
            
            # Process image using CLAHE
            with st.spinner("🔄 Applying CLAHE enhancement..."):
                start_time = st.empty()
                processed_image = apply_clahe_opencv(original_image, clip_limit, tile_grid_size)
            
            # Display before/after comparison
            st.markdown("## 🔍 Before & After Comparison")
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.markdown("### Original Image")
                st.image(original_image, use_container_width=True)
                
                # Original metrics
                orig_brightness, orig_contrast = calculate_metrics(original_image)
                st.markdown(f"**Brightness:** {orig_brightness:.1f}")
                st.markdown(f"**Contrast:** {orig_contrast:.1f}")
            
            with col2:
                st.markdown("### Enhanced Image (CLAHE)")
                st.image(processed_image, use_container_width=True)
                
                # Enhanced metrics
                enh_brightness, enh_contrast = calculate_metrics(processed_image)
                brightness_diff = enh_brightness - orig_brightness
                contrast_diff = enh_contrast - orig_contrast
                
                st.markdown(f"**Brightness:** {enh_brightness:.1f} ({brightness_diff:+.1f})")
                st.markdown(f"**Contrast:** {enh_contrast:.1f} ({contrast_diff:+.1f})")
            
            # Enhancement metrics summary
            st.markdown("## 📊 Enhancement Summary")
            
            metrics_col1, metrics_col2, metrics_col3, metrics_col4 = st.columns(4)
            
            with metrics_col1:
                st.metric(
                    "Brightness Change",
                    f"{brightness_diff:+.1f}",
                    delta=f"{(brightness_diff/orig_brightness*100):+.1f}%"
                )
            
            with metrics_col2:
                st.metric(
                    "Contrast Change",
                    f"{contrast_diff:+.1f}",
                    delta=f"{(contrast_diff/orig_contrast*100):+.1f}%"
                )
            
            with metrics_col3:
                st.metric(
                    "Clip Limit",
                    f"{clip_limit}",
                    help="Current CLAHE clip limit setting"
                )
            
            with metrics_col4:
                st.metric(
                    "Tile Size",
                    f"{tile_grid_size}x{tile_grid_size}",
                    help="Current CLAHE tile grid size"
                )
            
            # Download section
            st.markdown("## 💾 Download Enhanced Image")
            
            # Generate filename for processed image
            base_filename = uploaded_file.name.rsplit('.', 1)[0]
            processed_filename = f"{base_filename}_clahe_enhanced.png"
            
            # Create download button
            create_download_link(processed_image, processed_filename)
            
            # Technical details
            with st.expander("🔧 Technical Details"):
                st.markdown(f"""
                **CLAHE Algorithm Details:**
                - **Color Space:** LAB (L*a*b*)
                - **Processing Channel:** L (Lightness) only
                - **Clip Limit:** {clip_limit}
                - **Tile Grid:** {tile_grid_size}×{tile_grid_size}
                - **Total Tiles:** {tile_grid_size * tile_grid_size}
                - **Tile Size:** {original_image.size[0]//tile_grid_size}×{original_image.size[1]//tile_grid_size} pixels
                
                **Enhancement Applied:**
                - Adaptive histogram equalization per tile
                - Contrast limiting to prevent over-enhancement
                - Bilinear interpolation between neighboring tiles
                - Preserves color information (a* and b* channels unchanged)
                """)
            
        except Exception as e:
            st.error(f"❌ Error processing image: {str(e)}")
            st.markdown("Please ensure you've uploaded a valid image file.")
    
    else:
        # Instructions when no file is uploaded
        st.info("📷 Upload an image file to apply CLAHE enhancement for tattoo stencil preparation.")
        
        # Example images or demo
        st.markdown("## 🎯 What is CLAHE?")
        st.markdown("""
        **Contrast Limited Adaptive Histogram Equalization (CLAHE)** is an advanced image enhancement technique that:
        
        - 🔍 **Enhances local contrast** while preventing over-amplification
        - 🎨 **Preserves image details** in both dark and bright regions  
        - ⚡ **Processes adaptively** using contextual tile-based analysis
        - 🎭 **Maintains color balance** by working in LAB color space
        - 📐 **Perfect for tattoo stencils** requiring crisp, clear outlines
        
        **Optimal for:**
        - Dark or underexposed tattoo reference images
        - Photos with uneven lighting
        - Images requiring better detail definition
        - Professional tattoo stencil preparation
        """)

if __name__ == "__main__":
    main()