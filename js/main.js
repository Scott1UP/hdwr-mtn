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
  const valCompass = document.getElementById('valCompass');
  const compassIndicator = document.querySelector('.indicator-compass');
  const orbs = document.querySelectorAll('.orb');
  const bgOrbsLayer = document.querySelector('.bg-orbs');

  // Current smoothed tilt values (range: -1 to 1)
  let tiltX = 0;
  let tiltY = 0;
  let targetX = 0;
  let targetY = 0;
  let useGyro = false;

  // Compass state
  let compassHeading = 0;
  let targetHeading = 0;
  let compassAvailable = false;

  // Direction color palettes [R, G, B]
  const DIR_PALETTES = {
    N: { orbs: [[78,205,196], [0,180,216], [144,224,239]], bg: [10,15,20] },
    E: { orbs: [[255,107,53], [255,209,102], [244,132,95]], bg: [20,15,10] },
    S: { orbs: [[6,214,160], [17,138,178], [255,209,102]], bg: [10,20,15] },
    W: { orbs: [[155,93,229], [241,91,181], [94,96,206]], bg: [16,10,20] }
  };

  function directionWeight(heading, center) {
    let diff = Math.abs(heading - center);
    if (diff > 180) diff = 360 - diff;
    return Math.max(0, 1 - diff / 90);
  }

  function blendColor(weights, colorsByDir) {
    let r = 0, g = 0, b = 0;
    for (const dir of ['N', 'E', 'S', 'W']) {
      r += weights[dir] * colorsByDir[dir][0];
      g += weights[dir] * colorsByDir[dir][1];
      b += weights[dir] * colorsByDir[dir][2];
    }
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  }

  function getCardinalLabel(heading) {
    if (heading >= 337.5 || heading < 22.5) return 'N';
    if (heading < 67.5) return 'NE';
    if (heading < 112.5) return 'E';
    if (heading < 157.5) return 'SE';
    if (heading < 202.5) return 'S';
    if (heading < 247.5) return 'SW';
    if (heading < 292.5) return 'W';
    return 'NW';
  }

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

    // Compass-driven background blending
    if (compassAvailable) {
      // Circular lerp (shortest path through 360°)
      let diff = targetHeading - compassHeading;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      compassHeading += diff * 0.08;
      compassHeading = ((compassHeading % 360) + 360) % 360;

      const weights = {
        N: directionWeight(compassHeading, 0),
        E: directionWeight(compassHeading, 90),
        S: directionWeight(compassHeading, 180),
        W: directionWeight(compassHeading, 270)
      };

      // Blend orb colors
      for (let i = 0; i < 3; i++) {
        const colorSources = {
          N: DIR_PALETTES.N.orbs[i],
          E: DIR_PALETTES.E.orbs[i],
          S: DIR_PALETTES.S.orbs[i],
          W: DIR_PALETTES.W.orbs[i]
        };
        orbs[i].style.background = blendColor(weights, colorSources);
      }

      // Set base background on the orb container so it composites
      // on the same GPU layer as the orbs (avoids seam at extreme tilt)
      const bgSources = {
        N: DIR_PALETTES.N.bg,
        E: DIR_PALETTES.E.bg,
        S: DIR_PALETTES.S.bg,
        W: DIR_PALETTES.W.bg
      };
      bgOrbsLayer.style.background = blendColor(weights, bgSources);

      // Update compass CSS property and indicator
      root.style.setProperty('--compass', compassHeading.toFixed(1));
      const label = getCardinalLabel(compassHeading);
      valCompass.textContent = `${Math.round(compassHeading)}° ${label}`;
      valCompass.value = compassHeading.toFixed(0);
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

    // Compass heading
    let heading = null;
    if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
      // iOS: webkitCompassHeading is 0=North, clockwise
      if (e.webkitCompassAccuracy > 0 && e.webkitCompassAccuracy < 50) {
        heading = e.webkitCompassHeading;
      }
    } else if (e.alpha !== null) {
      // Android: convert alpha to compass heading
      heading = (360 - e.alpha) % 360;
    }

    if (heading !== null) {
      targetHeading = heading;
      if (!compassAvailable) {
        compassAvailable = true;
        compassIndicator.style.display = 'flex';
      }
    }
  }

  function startGyro() {
    useGyro = true;
    modeLabel.textContent = 'Gyroscope + Compass';
    valSource.textContent = 'Gyro';
    valSource.value = 'gyroscope';
    window.addEventListener('deviceorientation', handleOrientation);
    // Try absolute orientation for true-north compass on Android
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', handleOrientation);
    }
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

  // --- Desktop compass widget ---
  const compassWidget = document.getElementById('compassWidget');
  const compassHandle = document.getElementById('compassHandle');
  const compassReadout = document.getElementById('compassReadout');
  let widgetDragging = false;
  let widgetPointerId = null;

  function getAngleFromPointer(e) {
    const rect = compassWidget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    // atan2 gives angle from positive X axis; rotate so up (negative Y) = 0°
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    return ((angle % 360) + 360) % 360;
  }

  function positionHandle(angleDeg) {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    const r = 38; // track radius in px (matches SVG circle r=40 scaled to 96px widget)
    const x = Math.cos(rad) * r;
    const y = Math.sin(rad) * r;
    compassHandle.style.transform = `translate(${x}px, ${y}px)`;
  }

  function updateFromAngle(angleDeg) {
    positionHandle(angleDeg);
    compassReadout.textContent = `${Math.round(angleDeg)}°`;
    targetHeading = angleDeg;
    if (!compassAvailable) {
      compassAvailable = true;
      compassIndicator.style.display = 'flex';
    }
  }

  compassWidget.addEventListener('pointerdown', function (e) {
    // Ignore if it's a touch event on a device with gyro (widget shouldn't be visible, but just in case)
    if (useGyro) return;
    widgetDragging = true;
    widgetPointerId = e.pointerId;
    compassWidget.setPointerCapture(e.pointerId);
    updateFromAngle(getAngleFromPointer(e));
  });

  document.addEventListener('pointermove', function (e) {
    if (!widgetDragging || e.pointerId !== widgetPointerId) return;
    updateFromAngle(getAngleFromPointer(e));
  });

  document.addEventListener('pointerup', function (e) {
    if (!widgetDragging || e.pointerId !== widgetPointerId) return;
    widgetDragging = false;
    try { compassWidget.releasePointerCapture(e.pointerId); } catch (_) {}
    widgetPointerId = null;
  });

  // Hide widget when gyroscope is active
  function checkCompassVisibility() {
    if (useGyro) {
      compassWidget.classList.add('hidden');
    } else {
      compassWidget.classList.remove('hidden');
    }
  }
  checkCompassVisibility();
  setTimeout(checkCompassVisibility, 1200);
})();
