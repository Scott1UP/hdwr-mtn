(function () {
  const root = document.documentElement;
  const valX = document.getElementById('valX');
  const valY = document.getElementById('valY');
  const valSource = document.getElementById('valSource');
  const modeLabel = document.getElementById('modeLabel');
  const permOverlay = document.getElementById('permOverlay');
  const enableBtn = document.getElementById('enableBtn');
  const particlesContainer = document.getElementById('particles');

  // Current smoothed tilt values (range: -1 to 1)
  let tiltX = 0;
  let tiltY = 0;
  let targetX = 0;
  let targetY = 0;
  let useGyro = false;

  // Generate particles
  const PARTICLE_COUNT = 30;
  const particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const el = document.createElement('div');
    el.className = 'particle';
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const depth = 0.3 + Math.random() * 0.7; // parallax multiplier
    el.style.left = x + '%';
    el.style.top = y + '%';
    el.style.opacity = (0.05 + depth * 0.15).toFixed(2);
    el.style.width = el.style.height = (2 + depth * 3) + 'px';
    particlesContainer.appendChild(el);
    particles.push({ el, depth });
  }

  // Smoothing loop (lerp)
  function animate() {
    // Smooth interpolation
    tiltX += (targetX - tiltX) * 0.1;
    tiltY += (targetY - tiltY) * 0.1;

    // Clamp
    tiltX = Math.max(-1, Math.min(1, tiltX));
    tiltY = Math.max(-1, Math.min(1, tiltY));

    // Apply CSS custom properties
    root.style.setProperty('--tilt-x', tiltX.toFixed(4));
    root.style.setProperty('--tilt-y', tiltY.toFixed(4));

    // Update readout
    const xVal = tiltX.toFixed(2);
    const yVal = tiltY.toFixed(2);
    valX.textContent = xVal;
    valX.value = xVal;
    valY.textContent = yVal;
    valY.value = yVal;

    // Move particles with individual depth
    for (const p of particles) {
      const px = tiltX * p.depth * 35;
      const py = tiltY * p.depth * 35;
      p.el.style.transform = `translate(${px}px, ${py}px)`;
    }

    requestAnimationFrame(animate);
  }
  animate();

  // Mouse fallback (desktop)
  function initMouse() {
    modeLabel.textContent = 'Mouse input';
    valSource.textContent = 'Mouse';
    valSource.value = 'mouse';
    document.addEventListener('mousemove', (e) => {
      targetX = ((e.clientX / window.innerWidth) - 0.5) * 2;
      targetY = ((e.clientY / window.innerHeight) - 0.5) * 2;
    });
  }

  // Device orientation handler
  function handleOrientation(e) {
    // gamma: left/right tilt (-90 to 90)
    // beta: front/back tilt (-180 to 180)
    const gamma = e.gamma || 0;
    const beta = e.beta || 0;

    // Normalise to -1…1 (clamped at ±30° for comfortable range)
    targetX = Math.max(-1, Math.min(1, gamma / 30));
    targetY = Math.max(-1, Math.min(1, (beta - 45) / 30)); // offset 45° for typical hold angle
  }

  function startGyro() {
    useGyro = true;
    modeLabel.textContent = 'Gyroscope';
    valSource.textContent = 'Gyro';
    valSource.value = 'gyroscope';
    window.addEventListener('deviceorientation', handleOrientation);
    permOverlay.close();
  }

  // Detect capabilities and init
  function init() {
    const hasDeviceOrientation = 'DeviceOrientationEvent' in window;

    if (!hasDeviceOrientation) {
      // No sensor support → mouse only
      initMouse();
      return;
    }

    // Check if permission API exists (iOS 13+)
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      // Show permission overlay
      permOverlay.showModal();
      enableBtn.addEventListener('click', async () => {
        try {
          const state = await DeviceOrientationEvent.requestPermission();
          if (state === 'granted') {
            startGyro();
          } else {
            // Permission denied → fall back to mouse
            permOverlay.close();
            initMouse();
          }
        } catch (err) {
          console.error('Permission error:', err);
          permOverlay.close();
          initMouse();
        }
      });

      // Also init mouse as immediate fallback for desktop visitors
      // who might be on a Mac with no gyro
      initMouse();
    } else {
      // Android or older iOS — try listening directly
      // Test if events actually fire
      let received = false;
      const testHandler = (e) => {
        if (e.gamma !== null || e.beta !== null) {
          received = true;
          window.removeEventListener('deviceorientation', testHandler);
          startGyro();
        }
      };
      window.addEventListener('deviceorientation', testHandler);

      // If no events received after 1s, fall back to mouse
      setTimeout(() => {
        if (!received) {
          window.removeEventListener('deviceorientation', testHandler);
          initMouse();
        }
      }, 1000);
    }
  }

  init();
})();
