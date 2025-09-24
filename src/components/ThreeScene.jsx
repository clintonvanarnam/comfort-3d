'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useRouter } from 'next/navigation';
import { getPosts } from '@/lib/getPosts';
import gsap from 'gsap';
import NavBar from './NavBar';

export default function ThreeScene() {
  // Store sphereSeed in a ref so it's only generated on the client after mount
  const sphereSeedRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [introFading, setIntroFading] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState(null);
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const containerRef = useRef();
  const router = useRouter();
  const clickedRef = useRef(null);
  const [introCursor, setIntroCursor] = useState({ x: 0, y: 0, visible: false });
  const preloadedTexturesRef = useRef({});
  const preloadedPostsRef = useRef(null);
  const preloadedDoneRef = useRef(false);
  const introCompleteRef = useRef(false);
  // sphere mode is always enabled by default
  const useSphereRef = useRef(true);
  const sphereGroupRef = useRef(null);
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const touchStartRef = useRef({ x: 0, y: 0 });
  const touchMovedRef = useRef(false);
  const lastInteractionTimeRef = useRef(0);
  const touchHoldTimerRef = useRef(null);
  const touchHoldActiveRef = useRef(false);
  const pointerDownTimeRef = useRef(0);
  const sphereRotationTargetRef = useRef({ x: 0, y: 0 });
  const hoverEnabledRef = useRef(true);
  // Refs for Three.js resources to enable cleanup
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const animateIdRef = useRef(null);

  // Cleanup function to dispose Three.js resources and stop animation
  const cleanupThreeJS = () => {
    // Detect iOS for more conservative cleanup
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

    console.log('Cleanup: Starting Three.js cleanup, isIOS:', isIOS);

    if (animateIdRef.current) {
      cancelAnimationFrame(animateIdRef.current);
      animateIdRef.current = null;
    }

    // On iOS, be extremely conservative - don't dispose anything to prevent context issues
    if (isIOS) {
      console.log('Cleanup: iOS detected - skipping all disposal to prevent reloads');
      return;
    }

    if (rendererRef.current) {
      console.log('Cleanup: Disposing renderer');
      rendererRef.current.dispose();
      rendererRef.current = null;
    }

    if (sceneRef.current) {
      console.log('Cleanup: Disposing scene resources');
      // Dispose geometries and materials
      sceneRef.current.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => mat.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      sceneRef.current = null;
    }
    cameraRef.current = null;
    console.log('Cleanup: Three.js cleanup complete');
  };

  useEffect(() => {
    // keep a ref in sync so event listeners inside the scene can check
    // whether the intro overlay has been dismissed without stale closures
    introCompleteRef.current = introComplete;
  }, [introComplete]);

  useEffect(() => {
  // Only update hoveredInfo UI, do not play speech on hover
  // Speech is handled in the click/tap handler below
  }, [hoveredInfo]);

  useEffect(() => {
    setMounted(true);
    // Only generate sphereSeed on the client after mount
    if (sphereSeedRef.current === null) {
      sphereSeedRef.current = Math.random() * Math.PI * 2;
    }
    // add a body class so other parts of the UI (like the footer) can
    // respond to the 3D-scene being active and hide UI that shouldn't overlay.
    if (typeof document !== 'undefined') document.body.classList.add('three-scene-active');
    // start preloading posts and textures in the background with limited concurrency
    (async function preload() {
      try {
        const posts = await getPosts();
        preloadedPostsRef.current = posts;
        const loader = new THREE.TextureLoader();
        const items = posts.filter(p => p && p.image).map(p => ({
          key: p.slug?.current || p.slug || p._id || p.title,
          url: p.image,
        }));

        if (!items.length) {
          preloadedDoneRef.current = true;
          return;
        }

        const maxConcurrent = 4; // tune as needed
        let idx = 0;

        const loadTexturePromise = (url) => new Promise((resolve, reject) => {
          try {
            loader.load(url, (tex) => resolve(tex), undefined, () => reject(new Error('load error')));
          } catch (e) {
            reject(e);
          }
        });

        const worker = async () => {
          while (true) {
            const i = idx++;
            if (i >= items.length) return;
            const item = items[i];
            try {
              const tex = await loadTexturePromise(item.url);
              preloadedTexturesRef.current[item.key] = tex;
            } catch (e) {
              // ignore individual load errors
            }
          }
        };

        await Promise.all(Array.from({ length: Math.min(maxConcurrent, items.length) }, () => worker()));
        preloadedDoneRef.current = true;
      } catch (e) {
        console.warn('Preload failed', e);
        preloadedDoneRef.current = true;
      }
    })();

    return () => {
      if (typeof document !== 'undefined') document.body.classList.remove('three-scene-active');
    };
  }, []);

  // sphere mode always enabled via useSphereRef default

  useEffect(() => {
    if (!mounted) return;

    // Initialize the 3D scene as soon as the component mounts so sprites/textures
    // can be created and animated behind the intro overlay. We still keep the
    // intro overlay on top visually; when it is dismissed the scene is already ready.
    // Defer to next tick so DOM is ready.
    setTimeout(() => {
      async function init() {
        // prefer preloaded posts if available
        const posts = preloadedPostsRef.current || (await getPosts());
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    cameraRef.current = camera;
    // Start the camera offset along +Z so the sphere (at origin) is centered in view
    camera.position.set(0, 0, 10);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        rendererRef.current = renderer;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.setClearColor(0x000000, 1); // Set background to black
        // Respect devicePixelRatio for crisper rendering but clamp for perf.
        // Lower the cap on low-memory or slow-network devices to reduce CPU/GPU work.
        const dpr = window.devicePixelRatio || 1;
        let dprCap = 2;
        try {
          const nav = navigator;
          const connection = nav && nav.connection;
          const effectiveType = connection && connection.effectiveType;
          const saveData = connection && connection.saveData;
          const deviceMemory = nav.deviceMemory || 4;
          if (saveData || (effectiveType && /2g|slow-2g/.test(effectiveType))) dprCap = 1;
          if (deviceMemory <= 1) dprCap = Math.min(dprCap, 1);
          if (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 2) dprCap = Math.min(dprCap, 1.25);
        } catch (e) {
          // ignore
        }
        renderer.setPixelRatio(Math.min(dpr, dprCap));
  // Use actual container size so mouse/touch coordinates map correctly
  const initialWidth = containerRef.current ? containerRef.current.clientWidth : window.innerWidth;
  const initialHeight = containerRef.current ? containerRef.current.clientHeight : window.innerHeight;
  // Use the container aspect for the camera so projection matches the canvas size
  camera.aspect = initialWidth / initialHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(initialWidth, initialHeight, false);
        if (containerRef.current) {
          containerRef.current.appendChild(renderer.domElement);
          // avoid the browser's default touch gestures interfering with pointer events
          renderer.domElement.style.touchAction = 'none';
          // ensure the canvas exactly covers the container and has no extra offset
          renderer.domElement.style.position = 'absolute';
          renderer.domElement.style.top = '0';
          renderer.domElement.style.left = '0';
          renderer.domElement.style.width = '100%';
          renderer.domElement.style.height = '100%';
          renderer.domElement.style.display = 'block';
        }

        // Ensure camera initially points at the scene origin (sphere center)
        camera.lookAt(scene.position);

  const loader = new THREE.TextureLoader();
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const sprites = [];
  const preloadedSprites = [];
  const lateSprites = [];
  let phase1Done = false;
  const sphereGroup = new THREE.Group();
  sphereGroupRef.current = sphereGroup;
  scene.add(sphereGroup);
  // Use sphereSeed from ref so it's only generated on the client
  const sphereSeed = sphereSeedRef.current ?? 0;

  // Create sprites in small batches to avoid blocking the main thread
  (function createSpritesInBatches() {
    const batchSize = 6; // tune to balance throughput vs responsiveness
    // Use a shuffled copy of posts for placement so sprites don't appear
    // in the same locations each load. Fisher-Yates shuffle for uniformity.
    const placementPosts = posts.slice();
    for (let s = placementPosts.length - 1; s > 0; s--) {
      const r = Math.floor(Math.random() * (s + 1));
      const tmp = placementPosts[s];
      placementPosts[s] = placementPosts[r];
      placementPosts[r] = tmp;
    }
    let i = 0;
    const total = placementPosts.length;

    const processBatch = () => {
      const end = Math.min(i + batchSize, total);
      for (let idx = i; idx < end; idx++) {
        const post = placementPosts[idx];
        if (!post || !post.image) continue;
        const key = post.slug?.current || post.slug || post._id || post.title;
        const preTex = preloadedTexturesRef.current[key];
        const onTexture = (texture, wasPreloaded = false) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 1 });
          const sprite = new THREE.Sprite(material);
          const baseHeight = 1.5;
          const imageAspect = texture.image.width / texture.image.height;
          const width = baseHeight * imageAspect;
          const height = baseHeight;
          sprite.scale.set(width, height, 1);
          if (useSphereRef.current) {
            const goldenAngle = Math.PI * (3 - Math.sqrt(5));
            const y = 1 - (idx / (total - 1 || 1)) * 2; // from 1 to -1
            const radiusAtY = Math.sqrt(1 - y * y);
            const theta = goldenAngle * idx + sphereSeed;
            const x = Math.cos(theta) * radiusAtY;
            const z = Math.sin(theta) * radiusAtY;
            const sphereRadius = 4;
            sprite.position.set(x * sphereRadius, y * sphereRadius, z * sphereRadius);
            sphereGroup.add(sprite);
          } else {
            sprite.position.set(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * -2 + 2);
            scene.add(sprite);
          }
          sprite.userData = {
            slug: post.slug?.current || post.slug || '',
            title: typeof post.title === 'string' ? post.title : 'Untitled',
            author: post.author || '',
            imageUrl: post.image || '',
            floatPhase: Math.random() * Math.PI * 2,
            floatSpeed: 0.5 + Math.random(),
            floatAmplitude: 0.2 + Math.random() * 0.3,
            baseY: sprite.position.y,
            floating: true,
            imageAspect,
            preloaded: !!preTex,
            origScale: { x: sprite.scale.x, y: sprite.scale.y },
          };
          sprite.material.opacity = 0;
          sprite.scale.set(0.001, 0.001, 0.001);
          sprites.push(sprite);
          if (wasPreloaded) preloadedSprites.push(sprite);
          else lateSprites.push(sprite);
          if (phase1Done && !wasPreloaded) {
            gsap.to(sprite.material, { opacity: 1, duration: 0.14, ease: 'power1.out' });
            gsap.to(sprite.scale, {
              x: sprite.userData.origScale.x,
              y: sprite.userData.origScale.y,
              duration: 0.14,
              ease: 'back.out(1.1)'
            });
          }
        };

        if (preTex) {
          onTexture(preTex, true);
        } else {
          loader.load((post.image), (texture) => onTexture(texture, false));
        }
      }
      i = end;
      if (i < total) {
        // yield to the main thread briefly
        setTimeout(processBatch, 30);
      }
    };

    processBatch();
  })();

  // After all sprites have been added, run a quick two-phase staggered entrance
        // Phase 1: animate preloaded sprites quickly
        setTimeout(() => {
          if (preloadedSprites.length > 0) {
            const mats = preloadedSprites.map((s) => s.material);
            const scales = preloadedSprites.map((s) => s.scale);
            gsap.to(mats, { opacity: 1, duration: 0.18, ease: 'power1.out', stagger: 0.01 });
            gsap.to(scales, {
              x: (i, t) => preloadedSprites[i].userData.origScale.x,
              y: (i, t) => preloadedSprites[i].userData.origScale.y,
              duration: 0.18,
              ease: 'back.out(1.1)',
              stagger: 0.01,
            });
          }
          phase1Done = true;

          // Phase 2: shortly after phase 1, animate any currently-collected late sprites as a batch
          setTimeout(() => {
            if (lateSprites.length > 0) {
              // filter out any sprites that don't have userData/origScale to avoid runtime errors
              const validLate = lateSprites.filter((s) => s && s.userData && s.userData.origScale);
              const mats2 = validLate.map((s) => s.material);
              const scales2 = validLate.map((s) => s.scale);
              const origScales = validLate.map((s) => s.userData.origScale);
              if (mats2.length > 0) {
                gsap.to(mats2, { opacity: 1, duration: 0.14, ease: 'power1.out', stagger: 0.03 });
                gsap.to(scales2, {
                  x: (i, t) => origScales[i]?.x ?? t.x,
                  y: (i, t) => origScales[i]?.y ?? t.y,
                  duration: 0.14,
                  ease: 'back.out(1.1)',
                  stagger: 0.03,
                });
              }
              // clear lateSprites so new arrivals animate individually
              lateSprites.length = 0;
            }
          }, 120);
        }, 30);

        // pointer & mouse handling
        // Helper: map an event's client coords to normalized device coords relative to the canvas
        function updateMouseFromEvent(event) {
          if (!renderer || !renderer.domElement) return;
          const rect = renderer.domElement.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width;
          const y = (event.clientY - rect.top) / rect.height;
          mouse.x = x * 2 - 1;
          mouse.y = - (y * 2 - 1);
        }

        function onPointerMove(event) {
          // Ignore hover interactions until the intro overlay has been dismissed
          if (!introCompleteRef.current) return;
          // always update mouse for accurate raycasting
          updateMouseFromEvent(event);

          // Touch-specific handling: avoid treating touch moves as hover.
          if (event.pointerType === 'touch') {
            // determine whether this is a drag (move) vs a tap
            const dx = event.clientX - touchStartRef.current.x;
            const dy = event.clientY - touchStartRef.current.y;
            const dist = Math.hypot(dx, dy);
            // require a larger movement on touch to begin dragging to avoid accidental rotation
            if (dist > 18) {
              touchMovedRef.current = true;
              isDraggingRef.current = true;
              // dramatically reduce multipliers for touch so mobile rotation is much slower
              const touchYFactor = 0.0008; // far slower than mouse
              const touchXFactor = 0.0006;
              sphereRotationTargetRef.current.y += dx * touchYFactor;
              sphereRotationTargetRef.current.x += dy * touchXFactor;
              lastPointerRef.current.x = event.clientX;
              lastPointerRef.current.y = event.clientY;
            }

            // do not run hover raycasting for touch pointers (prevents hover jitter)
            return;
          }

          // Mouse/pen pointer: existing hover + drag behavior
          // if dragging, update rotation target based on pointer delta (drag-to-rotate)
          if (isDraggingRef.current) {
            const dx = event.clientX - lastPointerRef.current.x;
            const dy = event.clientY - lastPointerRef.current.y;
            // adjust sensitivity as needed
            sphereRotationTargetRef.current.y += dx * 0.005;
            sphereRotationTargetRef.current.x += dy * 0.003;
            lastPointerRef.current.x = event.clientX;
            lastPointerRef.current.y = event.clientY;
          }

          // raycast for hover/cursor feedback (independent of rotation input)
          raycaster.setFromCamera(mouse, camera);
          const intersects = raycaster.intersectObjects(sprites);
          if (containerRef.current) {
            containerRef.current.style.cursor = intersects.length > 0 ? 'pointer' : 'default';
          }

          if (intersects.length > 0) {
            const hovered = intersects[0].object;
            setHoveredInfo({ title: hovered.userData.title, author: hovered.userData.author });
            if (!hovered.userData.preloaded) {
              // prefetch the route (Next) and warm the HTTP cache for the full image
              router.prefetch(`/posts/${hovered.userData.slug}`);
              try {
                const img = new Image();
                img.src = hovered.userData.imageUrl || '';
              } catch (e) {
                // ignore
              }
              hovered.userData.preloaded = true;
            }
          } else {
            setHoveredInfo(null);
          }
        }

        function onPointerDown(e) {
          // ensure mouse is up-to-date even if the user didn't move before tapping
          updateMouseFromEvent(e);
          if (e.pointerType === 'touch') {
            // initialize touch tracking; don't mark as dragging yet
            touchStartRef.current.x = e.clientX;
            touchStartRef.current.y = e.clientY;
            touchMovedRef.current = false;
            touchHoldActiveRef.current = false;
            isDraggingRef.current = false;
            pointerDownTimeRef.current = Date.now();
            // start a hold timer; only after this delay will movement become rotation
            const holdDelay = 250; // ms - tuneable
            if (touchHoldTimerRef.current) clearTimeout(touchHoldTimerRef.current);
            touchHoldTimerRef.current = setTimeout(() => {
              touchHoldActiveRef.current = true;
              // begin drag state only when hold becomes active
              isDraggingRef.current = true;
              lastPointerRef.current.x = e.clientX;
              lastPointerRef.current.y = e.clientY;
            }, holdDelay);
          } else {
            isDraggingRef.current = true;
            lastPointerRef.current.x = e.clientX;
            lastPointerRef.current.y = e.clientY;
          }
        }

        function onPointerUp(e) {
          // Cleanup hold timer if present
          if (touchHoldTimerRef.current) {
            clearTimeout(touchHoldTimerRef.current);
            touchHoldTimerRef.current = null;
          }

          // If the intro overlay hasn't been dismissed yet, ignore pointerup
          // interactions so a tap used to reveal the scene doesn't also
          // select a sprite underneath.
          if (!introCompleteRef.current) {
            // reset transient touch/drag state
            touchMovedRef.current = false;
            isDraggingRef.current = false;
            touchHoldActiveRef.current = false;
            return;
          }

          if (e && e.pointerType === 'touch') {
            // If the hold became active, we were dragging; stop dragging and don't treat as a click
            if (touchHoldActiveRef.current) {
              touchHoldActiveRef.current = false;
              isDraggingRef.current = false;
              touchMovedRef.current = false;
              return;
            }

            // short touch (no hold) counts as a click/tap regardless of tiny movement
            lastInteractionTimeRef.current = Date.now();
            updateMouseFromEvent(e);
            handleInteraction();
            touchMovedRef.current = false;
            isDraggingRef.current = false;
            return;
          }

          // small delay to allow click handlers to check dragging state for mouse/pen
          isDraggingRef.current = false;
        }

        function onPointerCancel(e) {
          if (touchHoldTimerRef.current) {
            clearTimeout(touchHoldTimerRef.current);
            touchHoldTimerRef.current = null;
          }
          touchHoldActiveRef.current = false;
          touchMovedRef.current = false;
          isDraggingRef.current = false;
        }

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointerup', onPointerUp);

        // Keep renderer & camera sized to the container if the viewport changes
        function onWindowResize() {
          if (!containerRef.current) return;
          const w = containerRef.current.clientWidth;
          const h = containerRef.current.clientHeight;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
          renderer.setSize(w, h, false);
        }
  window.addEventListener('resize', onWindowResize);

  window.addEventListener('click', (e) => {
          // Ignore interactions until intro is dismissed
          if (!introCompleteRef.current) return;
          // Dedupe after touch-based pointerup already triggered the interaction
          if (Date.now() - lastInteractionTimeRef.current < 500) return;
          // update mouse from the click location (covers taps without prior move)
          updateMouseFromEvent(e);
          // ignore clicks that happen while dragging
          if (!isDraggingRef.current) handleInteraction();
        });
  window.addEventListener('pointercancel', onPointerCancel);

        function handleInteraction() {
          raycaster.setFromCamera(mouse, camera);
          const intersects = raycaster.intersectObjects(sprites);

          if (intersects.length > 0 && !clickedRef.current) {
            const clickedSprite = intersects[0].object;
            const { slug, imageAspect, imageUrl } = clickedSprite.userData;

            // Robust image URL check
            if (!imageUrl || typeof imageUrl !== 'string' || !/^https?:\/\/.+|\/[^\s]+\.(jpg|jpeg|png|gif|webp|svg)$/i.test(imageUrl)) {
              alert('This post is missing a valid image URL and cannot be displayed.');
              return;
            }

            // If sprite is inside a group (e.g., sphereGroup), reparent it to the scene
            // while preserving its world position so the animation to center is correct.
            if (clickedSprite.parent && clickedSprite.parent !== scene) {
              const worldPos = new THREE.Vector3();
              clickedSprite.getWorldPosition(worldPos);
              clickedSprite.parent.remove(clickedSprite);
              scene.add(clickedSprite);
              clickedSprite.position.copy(worldPos);
            }
            clickedRef.current = clickedSprite;
            setSelectedTitle(clickedSprite.userData.title);

            // disable hover-based speech after a user click
            hoverEnabledRef.current = false;

            // speak the title and author once on click
            if (typeof window !== 'undefined' && window.speechSynthesis && window.SpeechSynthesisUtterance) {
              window.speechSynthesis.cancel();
              const utt = new window.SpeechSynthesisUtterance();
              utt.text = clickedSprite.userData.author
                ? `${clickedSprite.userData.title} by ${clickedSprite.userData.author}`
                : clickedSprite.userData.title;
              utt.rate = 1.05;
              utt.pitch = 1.1;
              window.speechSynthesis.speak(utt);
            }

            sprites.forEach(sprite => sprite.userData.floating = false);

            sprites.forEach((sprite) => {
              if (sprite !== clickedSprite) {
                gsap.to(sprite.position, { y: sprite.position.y - 10, duration: 1, ease: 'power2.in' });
                gsap.to(sprite.material, { opacity: 0, duration: 0.8, ease: 'power1.out' });
              }
            });

            const targetHeight = 2;
            const targetWidth = targetHeight * imageAspect;

            gsap.to(clickedSprite.position, { x: 0, y: 0, z: 2, duration: 1, ease: 'power2.out' });
            gsap.to(clickedSprite.scale, { x: targetWidth, y: targetHeight, duration: 1, ease: 'power2.out' });

            // Use shorter animation on iOS to reduce memory pressure
            const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
            const animationDelay = isIOS ? 0.5 : 2;
            const animationDuration = isIOS ? 0.3 : 0.5;

            gsap.to(clickedSprite.material, {
              opacity: 0,
              delay: animationDelay,
              duration: animationDuration,
              ease: 'power1.in',
              onComplete: () => {
                console.log('Navigation: Starting navigation for', slug);
                // Skip cleanup on iOS to prevent reload issues
                const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
                if (!isIOS) {
                  cleanupThreeJS();
                } else {
                  console.log('Navigation: Skipping cleanup on iOS');
                  // Just stop animation loop
                  if (animateIdRef.current) {
                    cancelAnimationFrame(animateIdRef.current);
                    animateIdRef.current = null;
                  }
                }

                if (slug && typeof slug === 'string' && slug.trim()) {
                  console.log('Navigation: Attempting router.push for iOS');
                  // Use a more iOS-friendly approach
                  router.push(`/posts/${slug}`).catch((error) => {
                    console.error('Router push failed, trying location.assign', error);
                    // Use assign instead of href for better SPA behavior
                    window.location.assign(`/posts/${slug}`);
                  });
                } else {
                  console.warn('Invalid slug for navigation', slug);
                }
              },
            });
          }
        }

        const clock = new THREE.Clock();
        function animate() {
          animateIdRef.current = requestAnimationFrame(animate);
          const t = clock.getElapsedTime();

          // Orbital camera: full rotation around the sphere based on mouse
          const radius = 10;
          if (!clickedRef.current) {
            // map mouse (-1..1) to spherical coordinates
            const azimuth = mouse.x * Math.PI; // -PI..PI
            const v = (mouse.y + 1) / 2; // 0..1
            const minPolar = 0.3;
            const maxPolar = Math.PI - 0.3;
            const polar = v * (maxPolar - minPolar) + minPolar; // 0.3..PI-0.3

            const targetX = radius * Math.sin(polar) * Math.cos(azimuth);
            const targetY = radius * Math.cos(polar);
            const targetZ = radius * Math.sin(polar) * Math.sin(azimuth);

            // smooth towards target
            camera.position.x += (targetX - camera.position.x) * 0.08;
            camera.position.y += (targetY - camera.position.y) * 0.08;
            camera.position.z += (targetZ - camera.position.z) * 0.08;
          } else {
            // when a sprite is clicked, ease camera back to a frontal view centered on origin
            const target = { x: 0, y: 0, z: 5 };
            camera.position.x += (target.x - camera.position.x) * 0.1;
            camera.position.y += (target.y - camera.position.y) * 0.1;
            camera.position.z += (target.z - camera.position.z) * 0.1;
          }

          camera.lookAt(scene.position);

          // make all sprites face the camera
          sprites.forEach((s) => {
            if (s && s.lookAt) s.lookAt(camera.position);
          });

          // rotate sphere group based on rotation target (drag to rotate) with a light auto-rotate
          if (useSphereRef.current && sphereGroupRef.current) {
            const sphereGroup = sphereGroupRef.current;
            // gentle auto-rotation when not interacting
            if (!isDraggingRef.current) {
              sphereRotationTargetRef.current.y += 0.0012; // auto spin
            }
            sphereGroup.rotation.y += (sphereRotationTargetRef.current.y - sphereGroup.rotation.y) * 0.1;
            sphereGroup.rotation.x += (sphereRotationTargetRef.current.x - sphereGroup.rotation.x) * 0.08;
            // clamp X rotation to avoid flipping
            sphereGroup.rotation.x = Math.max(Math.min(sphereGroup.rotation.x, 0.9), -0.9);
          }

          renderer.render(scene, camera);
        }

        animate();
      }
      init();
    }, 0);

    // Cleanup Three.js resources when component unmounts or dependencies change
    return () => {
      cleanupThreeJS();
    };
  }, [mounted, router]);

  if (!mounted) return null;

  return (
    <>
      <NavBar />

      {/* Canvas container - always mounted so scene can initialize and load assets */}
      <div
        ref={containerRef}
        style={{ 
          width: '100vw', 
          height: 'calc(100vh + env(safe-area-inset-bottom) + 100px)', 
          overflow: 'hidden', 
          background: 'black', 
          position: 'relative'
        }}
      />

      {/* Intro overlay sits above the canvas and can be dismissed to reveal the scene */}
      <div
        onClick={() => {
          setIntroFading(true);
          setTimeout(() => setIntroComplete(true), 400);
        }}
        onMouseMove={(e) => setIntroCursor({ x: e.clientX, y: e.clientY, visible: true })}
        onMouseEnter={(e) => setIntroCursor({ x: e.clientX, y: e.clientY, visible: true })}
        onMouseLeave={() => setIntroCursor((s) => ({ ...s, visible: false }))}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (t) setIntroCursor({ x: t.clientX, y: t.clientY, visible: true });
        }}
        onTouchEnd={() => setIntroCursor((s) => ({ ...s, visible: false }))}
        style={{
          position: 'absolute',
          top: '-100px',
          left: 0,
          right: 0,
          bottom: '-100px',
          display: introComplete ? 'none' : 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'black',
          color: 'white',
          fontFamily: 'monospace',
          fontSize: '24px',
          cursor: 'none',
          zIndex: 2147483647,
          transition: 'opacity 0.4s',
          opacity: introFading ? 0 : 1,
        }}
      >
        <img
          src="/COMFORT_MAG_LOGO_WHITE.svg"
          alt="Comfort Logo"
          style={{
            maxWidth: '80%',
            maxHeight: '50%',
          }}
        />
        <div
          style={{
            position: 'fixed',
            left: introCursor.x,
            top: introCursor.y,
            transform: 'translate(-50%, -50%)',
            fontFamily: 'monospace',
            fontSize: '15px',
            color: '#fff',
            pointerEvents: 'none',
            zIndex: 2147483648,
            display: introCursor.visible ? 'block' : 'none',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            mixBlendMode: 'difference',
          }}
        >
          [CLICK]
        </div>
      </div>

      {/* sphere mode always on; hover info sits above the canvas */}
      {hoveredInfo && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            width: '100%',
            textAlign: 'center',
            fontSize: '1rem',
            fontFamily: 'var(--font-monument)',
            color: '#fff',
            background: 'transparent',
            zIndex: 99999999999,
            pointerEvents: 'none',
            padding: '1rem 0',
          }}
        >
          {hoveredInfo.title}
          {hoveredInfo.author && (
            <span style={{ marginLeft: '1rem', opacity: 0.7 }}>
              {hoveredInfo.author}
            </span>
          )}
        </div>
      )}
    </>
  );
}