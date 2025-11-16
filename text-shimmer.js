// Text Shimmer Component for AI Loading States
// Inspired by modern UI libraries like shadcn/ui

class TextShimmer {
  constructor(element, options = {}) {
    this.element = element;
    this.duration = options.duration || 2; // Moderate speed for visibility
    this.originalText = element.textContent;
    this.isActive = false;
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    
    // Wrap text in shimmer container with overlay effect
    // Keep original text color and add shimmer overlay on top
    const shimmerHTML = `
      <span class="text-shimmer-wrapper" style="
        position: relative;
        display: inline-block;
      ">
        ${this.element.textContent}
        <span class="text-shimmer-overlay" style="
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0) 40%,
            rgba(255, 255, 255, 0.6) 50%,
            rgba(255, 255, 255, 0) 60%,
            rgba(255, 255, 255, 0) 100%
          );
          background-size: 200% 100%;
          animation: shimmer ${this.duration}s linear infinite;
          pointer-events: none;
        "></span>
      </span>
    `;
    
    this.element.innerHTML = shimmerHTML;
    
    // Add keyframes if not already added
    if (!document.getElementById('text-shimmer-keyframes')) {
      const style = document.createElement('style');
      style.id = 'text-shimmer-keyframes';
      style.textContent = `
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  stop() {
    if (!this.isActive) return;
    this.isActive = false;
    
    // Restore original text
    this.element.textContent = this.originalText;
  }

  updateText(newText) {
    this.originalText = newText;
    if (this.isActive) {
      const wrapper = this.element.querySelector('.text-shimmer-wrapper');
      if (wrapper) {
        wrapper.textContent = newText;
      }
    } else {
      this.element.textContent = newText;
    }
  }
}

// Helper function to create shimmer effect on button
function createButtonShimmer(buttonId) {
  // In panel mode, button is directly in document
  // On page, button is inside #localizeai-panel
  let button = document.getElementById(buttonId);
  
  if (!button) {
    // Try searching in panel container (for page mode)
    const panel = document.getElementById('localizeai-panel');
    if (panel) {
      button = panel.querySelector(`#${buttonId}`);
    }
  }
  
  if (!button) {
    return null;
  }
  
  // Find the text span (first span that's not a badge)
  const spans = button.querySelectorAll('span');
  let textElement = null;
  
  for (const span of spans) {
    if (!span.classList.contains('badge')) {
      textElement = span;
      break;
    }
  }
  
  if (!textElement) {
    return null;
  }
  
  const shimmer = new TextShimmer(textElement, { duration: 1.5 });
  
  return {
    start: () => {
      button.disabled = true;
      button.style.opacity = '0.8';
      button.style.cursor = 'not-allowed';
      shimmer.start();
    },
    stop: () => {
      shimmer.stop();
      button.disabled = false;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
    }
  };
}

// Export for use in content.js
window.TextShimmer = TextShimmer;
window.createButtonShimmer = createButtonShimmer;
