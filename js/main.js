(function () {
  const root = document.documentElement;
  const valX = document.getElementById('valX');
  const valY = document.getElementById('valY');
  const valSource = document.getElementById('valSource');
  const modeLabel = document.getElementById('modeLabel');
  const permOverlay = document.getElementById('permOverlay');
  const enableBtn = document.getElementById('enableBtn');
  const particlesContainer = document.getElementById('particles');
  const cardStack = document.querySelector('.card-stack');

  // Current smoothed tilt values (range: -1 to 1)
  let tiltX = 0;
  let tiltY = 0;
  let targetX = 0;
  let targetY = 0;
  let useGyro = false;

  // Swipe state
  let isDragging = false;
  let isAnimating = false;
  let startX = 0;
  let currentX = 0;
  let dragOffset = 0;
  let activePointerId = null;
  let draggedCard = null;
  const SWIPE_THRESHOLD = 100;

  // Card positions: back (0), mid (1), front (2)
  const positions = ['card-back', 'card-mid', 'card-front'];
  let cards = Array.from(cardStack.querySelectorAll('.card'));

  function getTopCard() {
    return cards.find(card => card.classList.contains('card-front'));
  }

  function cycleCards(direction) {
    if (isAnimating) return;

    const topCard = getTopCard();
    if (!topCard) return;

    isAnimating = true;
    cardStack.classList.add('animating');

    // Immediately update z-index before animation starts
    topCard.style.zIndex = '0';

    // Add exit animation class
    topCard.classList.add(direction === 'left' ? 'exiting-left' : 'exiting-right');

    // Cycle the position classes quickly for snappier feel
    setTimeout(() => {
      cards.forEach(card => {
        if (card.classList.contains('card-front')) {
          card.classList.remove('card-front');
          card.classList.add('card-back');
        } else if (card.classList.contains('card-mid')) {
          card.classList.remove('card-mid');
          card.classList.add('card-front');
        } else if (card.classList.contains('card-back')) {
          card.classList.remove('card-back');
          card.classList.add('card-mid');
        }
      });
    }, 20);

    // Clean up after animation completes
    setTimeout(() => {
      topCard.classList.remove('exiting-left', 'exiting-right');
      topCard.style.zIndex = '';
      isAnimating = false;
      cardStack.classList.remove('animating');
    }, 350);
  }

  function handlePointerDown(e) {
    if (isAnimating || isDragging) return;

    const topCard = getTopCard();
    if (!topCard || !topCard.contains(e.target)) return;

    isDragging = true;
    draggedCard = topCard;
    activePointerId = e.pointerId;
    startX = e.clientX;
    currentX = e.clientX;
    draggedCard.classList.add('swiping');

    try {
      draggedCard.setPointerCapture(e.pointerId);
    } catch (err) {
      // Pointer capture may fail, continue anyway
    }
  }

  function handlePointerMove(e) {
    if (!isDragging || !draggedCard || e.pointerId !== activePointerId) return;

    currentX = e.clientX;
    dragOffset = currentX - startX;

    const progress = Math.min(Math.abs(dragOffset) / SWIPE_THRESHOLD, 1);
    const scale = 1 - (progress * 0.05);
    const rotation = (dragOffset / SWIPE_THRESHOLD) * 8;
    draggedCard.style.transform = `translateX(${dragOffset}px) scale(${scale}) rotateY(${rotation}deg)`;
  }

  function handlePointerUp(e) {
    if (!isDragging || e.pointerId !== activePointerId) return;

    const shouldCycle = Math.abs(dragOffset) > SWIPE_THRESHOLD;
    const direction = dragOffset < 0 ? 'left' : 'right';

    if (draggedCard) {
      draggedCard.classList.remove('swiping');
      draggedCard.style.transform = '';

      try {
        draggedCard.releasePointerCapture(e.pointerId);
      } catch (err) {
        // May fail if already released
      }
    }

    isDragging = false;
    const offset = dragOffset;
    dragOffset = 0;
    activePointerId = null;
    draggedCard = null;

    if (shouldCycle) {
      cycleCards(direction);
    }
  }

  // Attach swipe listeners
  cardStack.addEventListener('pointerdown', handlePointerDown);
  document.addEventListener('pointermove', handlePointerMove);
  document.addEventListener('pointerup', handlePointerUp);
  document.addEventListener('pointercancel', handlePointerUp);

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

    // Clamp with extended range
    tiltX = Math.max(-1.2, Math.min(1.2, tiltX));
    tiltY = Math.max(-1.2, Math.min(1.2, tiltY));

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
      targetX = ((e.clientX / window.innerWidth) - 0.5) * 2.4;
      targetY = ((e.clientY / window.innerHeight) - 0.5) * 2.4;
    });
  }

  // Device orientation handler
  function handleOrientation(e) {
    // gamma: left/right tilt (-90 to 90)
    // beta: front/back tilt (-180 to 180)
    const gamma = e.gamma || 0;
    const beta = e.beta || 0;

    // Normalise to -1.2…1.2 (clamped at ±25° for extended range)
    targetX = Math.max(-1.2, Math.min(1.2, gamma / 25));
    targetY = Math.max(-1.2, Math.min(1.2, (beta - 45) / 25)); // offset 45° for typical hold angle
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
