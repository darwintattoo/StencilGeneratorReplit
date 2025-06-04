import streamlit as st
import cv2
import numpy as np
from PIL import Image
import matplotlib.pyplot as plt
import io
import base64

def apply_histogram_equalization(image):
    """
    Apply histogram equalization to improve image exposure
    """
    # Convert PIL image to OpenCV format
    cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    
    # Convert to YUV color space for better exposure adjustment
    yuv_image = cv2.cvtColor(cv_image, cv2.COLOR_BGR2YUV)
    
    # Apply histogram equalization to Y channel (luminance)
    yuv_image[:, :, 0] = cv2.equalizeHist(yuv_image[:, :, 0])
    
    # Convert back to BGR and then to RGB
    corrected_bgr = cv2.cvtColor(yuv_image, cv2.COLOR_YUV2BGR)
    corrected_rgb = cv2.cvtColor(corrected_bgr, cv2.COLOR_BGR2RGB)
    
    return Image.fromarray(corrected_rgb)

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

def main():
    st.set_page_config(
        page_title="Automatic Image Exposure Adjustment",
        page_icon="📸",
        layout="wide"
    )
    
    st.title("📸 Automatic Image Exposure Adjustment")
    st.markdown("Upload an image and automatically improve its exposure using advanced histogram equalization techniques.")
    
    # Use CLAHE with fixed optimal parameters
    clip_limit = 2.0
    tile_grid_size = 8
    
    # File uploader
    uploaded_file = st.file_uploader(
        "Choose an image file",
        type=['jpg', 'jpeg', 'png'],
        help="Supported formats: JPEG, PNG"
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
            
            # Process image using CLAHE with optimal parameters
            with st.spinner("🔄 Processing image..."):
                processed_image = apply_clahe(original_image, clip_limit, tile_grid_size)
            
            # Display before/after comparison
            st.markdown("## 🔍 Before & After Comparison")
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.markdown("### Original Image")
                st.image(original_image, use_container_width=True)
            
            with col2:
                st.markdown("### Enhanced Image")
                st.image(processed_image, use_container_width=True)
            
            # Download section
            st.markdown("## 💾 Download Enhanced Image")
            
            # Generate filename for processed image
            base_filename = uploaded_file.name.rsplit('.', 1)[0]
            processed_filename = f"{base_filename}_enhanced_clahe.png"
            
            # Create download button
            img_buffer = io.BytesIO()
            processed_image.save(img_buffer, format='PNG')
            img_buffer.seek(0)
            
            st.download_button(
                label="📥 Download Enhanced Image",
                data=img_buffer.getvalue(),
                file_name=processed_filename,
                mime="image/png"
            )
            
            # Quality metrics
            st.markdown("## 📊 Enhancement Metrics")
            
            # Calculate some basic metrics
            original_array = np.array(original_image)
            processed_array = np.array(processed_image)
            
            # Calculate mean brightness
            original_brightness = np.mean(original_array)
            processed_brightness = np.mean(processed_array)
            
            # Calculate standard deviation (contrast measure)
            original_contrast = np.std(original_array)
            processed_contrast = np.std(processed_array)
            
            metrics_col1, metrics_col2, metrics_col3, metrics_col4 = st.columns(4)
            
            with metrics_col1:
                st.metric(
                    "Original Brightness",
                    f"{original_brightness:.1f}",
                    help="Average pixel intensity (0-255)"
                )
            
            with metrics_col2:
                st.metric(
                    "Enhanced Brightness",
                    f"{processed_brightness:.1f}",
                    delta=f"{processed_brightness - original_brightness:.1f}"
                )
            
            with metrics_col3:
                st.metric(
                    "Original Contrast",
                    f"{original_contrast:.1f}",
                    help="Standard deviation of pixel intensities"
                )
            
            with metrics_col4:
                st.metric(
                    "Enhanced Contrast",
                    f"{processed_contrast:.1f}",
                    delta=f"{processed_contrast - original_contrast:.1f}"
                )
            
        except Exception as e:
            st.error(f"❌ Error processing image: {str(e)}")
            st.markdown("Please ensure you've uploaded a valid image file (JPEG or PNG).")
    
    else:
        # Simple message when no file is uploaded
        st.info("Upload an image file to automatically adjust its exposure.")

if __name__ == "__main__":
    main()