"use client";

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useRouter } from 'next/navigation';
import { getPosts } from '@/lib/getPosts';
import gsap from 'gsap';
import NavBar from './NavBar';

// Global WebGL context management for iOS
let globalWebGLContextActive = false;

import styles from './ThreeScene.module.css';

export default function ThreeScene() {
  // Store sphereSeed in a ref so it's only generated on the client after mount
  const sphereSeedRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [introComplete, setIntroComplete] = useState(true);
  const [selectedTitle, setSelectedTitle] = useState(null);
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const containerRef = useRef();
  const router = useRouter();
  const clickedRef = useRef(null);
  const preloadedTexturesRef = useRef({});
  // Loading progress state (throttled updates)
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadingDone, setLoadingDone] = useState(false);
  const listenersRef = useRef([]);
  const loadTargetRef = useRef(0);
  const progressAnimatingRef = useRef(false);
  // Smoothly animate displayed progress toward target to avoid jumps
  function startProgressAnimator() {
    if (progressAnimatingRef.current) return;
    progressAnimatingRef.current = true;
    const step = () => {
      const current = loadProgress;
      const target = loadTargetRef.current;
      if (current >= 99 && target >= 100) {
        setLoadProgress(100);
        progressAnimatingRef.current = false;
        return;
      }
      const delta = target - current;
      if (Math.abs(delta) < 0.5) {
        if (current !== target) setLoadProgress(target);
      } else {
        setLoadProgress(Math.round((current + delta * 0.25) * 100) / 100);
      }
      if (progressAnimatingRef.current) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
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

  const isInitializingRef = useRef(false);
  const preloadStartedRef = useRef(false);
  const lastNavigationTime = useRef(0);

  // Texture optimization function for performance
  const optimizeTexture = (texture) => {
    // Images are now using thumbnails (800px) for sprites - no further downsizing needed
    
    // Enable mipmapping for better performance at distance
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    
    // Set color space
    texture.colorSpace = THREE.SRGBColorSpace;
    
    // Keep default flipY behavior for proper image orientation
    // texture.flipY = true; // This is the default, so we don't need to set it
    
    // Mark as needing update
    texture.needsUpdate = true;
    
    return texture;
  };

  // Cleanup function to dispose Three.js resources and stop animation
  const cleanupThreeJS = async (isUnmounting = false, forceDispose = false) => {
    // Detect iOS for more conservative cleanup
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

    console.log('Cleanup: Starting Three.js cleanup, isIOS:', isIOS, 'isUnmounting:', isUnmounting);

    if (animateIdRef.current) {
      cancelAnimationFrame(animateIdRef.current);
      animateIdRef.current = null;
    }

    // Reset initialization flag
    isInitializingRef.current = false;

    // On iOS, be conservative by default to avoid context loss issues, but allow
    // a forced disposal when navigation requires releasing memory (forceDispose)
    if (isIOS && !forceDispose) {
      console.log('Cleanup: iOS - stopping animation only, no disposal');
      // Just stop the animation loop, let WebGL context die naturally with page unload
      await new Promise(resolve => setTimeout(resolve, 100));
      return;
    }

    if (rendererRef.current) {
      try {
        console.log('Cleanup: Forcibly removing canvas from DOM');
        const canvas = rendererRef.current.domElement;
        if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      } catch (e) {}

      try {
        console.log('Cleanup: Disposing renderer');
        // Attempt to lose the context to free GPU memory
        if (rendererRef.current.forceContextLoss) {
          try { rendererRef.current.forceContextLoss(); console.log('Cleanup: Forced context loss attempted on iOS'); } catch (e) {}
        }
        rendererRef.current.dispose();
      } catch (e) {
        console.warn('Cleanup: Error disposing renderer', e);
      }
      rendererRef.current = null;
    }

    if (sceneRef.current) {
      console.log('Cleanup: Disposing scene resources');
      // Dispose geometries and materials and textures
      sceneRef.current.traverse((object) => {
        try {
          if (object.geometry) object.geometry.dispose();
        } catch (e) {}
        if (object.material) {
          const mats = Array.isArray(object.material) ? object.material : [object.material];
          mats.forEach((mat) => {
            try {
              if (mat.map) {
                try { mat.map.dispose(); } catch (e) {}
                mat.map = null;
              }
              if (mat.dispose) mat.dispose();
            } catch (e) {}
          });
        }
      });
      sceneRef.current = null;
    }
    cameraRef.current = null;

    // Remove any tracked global event listeners
    try {
      (listenersRef.current || []).forEach(({ type, handler, opts }) => {
        try { window.removeEventListener(type, handler, opts); } catch (e) {}
      });
    } catch (e) {}
    listenersRef.current = [];
    console.log('Cleanup: Three.js cleanup complete');
    
    // Wait a bit to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 50));
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
      if (preloadStartedRef.current) return;
      preloadStartedRef.current = true;
      console.time('Preload textures');
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
          console.time(`Preload texture: ${url}`);
          try {
            // Images are now using thumbnails (800px) for better quality while maintaining performance
            loader.load(url, (tex) => {
              console.timeEnd(`Preload texture: ${url}`);
              // Apply Three.js optimizations for better performance
              optimizeTexture(tex);
              resolve(tex);
            }, undefined, () => reject(new Error('load error')));
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
        console.timeEnd('Preload textures');
      } catch (e) {
        console.warn('Preload failed', e);
        console.timeEnd('Preload textures');
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

    // Small delay on iOS to ensure stability when remounting
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    const initDelay = isIOS ? 1000 : 0;

    // Prevent rapid remounting that can cause WebGL conflicts
    if (isInitializingRef.current) {
      console.log('ThreeScene: Already initializing, skipping...');
      return;
    }
    isInitializingRef.current = true;

    // Initialize the 3D scene as soon as the component mounts so sprites/textures
    // can be created and animated behind the intro overlay. We still keep the
    // intro overlay on top visually; when it is dismissed the scene is already ready.
    // Defer to next tick so DOM is ready.
    setTimeout(() => {
      async function init() {
        // prefer preloaded posts if available
          const posts = preloadedPostsRef.current || (await getPosts());
          // If we preloaded textures earlier, mark those URLs as loaded so progress starts correctly
          try {
            const preloaded = preloadedTexturesRef.current || {};
            const preloadedUrlSet = new Set();
            if (preloaded && Object.keys(preloaded).length > 0) {
              for (const p of posts) {
                const key = p.slug?.current || p.slug || p._id || p.title;
                if (preloaded[key]) {
                  if (p && p.image) preloadedUrlSet.add(p.image);
                }
              }
              // mark loaded URLs
              for (const url of preloadedUrlSet) {
                try {
                  if (url && !loadedUrls.has(url)) {
                    loadedUrls.add(url);
                    loadedCountRef.current += 1;
                  }
                } catch (e) {}
              }
              // schedule an initial progress update
              scheduleProgressUpdate();
            }
          } catch (e) {
            // ignore progress initialization errors
          }
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
        let dprCap = 2; // Increased from 1 since we're using smaller 800px textures
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
  // Prepare robust, URL-based loading counters so progress reflects unique textures
  const uniqueImageUrls = Array.from(new Set((posts || []).map(p => p && p.image).filter(Boolean)));
  const totalToLoad = uniqueImageUrls.length;
  const loadedUrls = new Set();
  const loadedCountRef = { current: 0 };
  let rafScheduled = false;
  function scheduleProgressUpdate() {
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      const pct = Math.round((loadedCountRef.current / Math.max(totalToLoad, 1)) * 100);
      loadTargetRef.current = pct;
      startProgressAnimator();
      if (loadedCountRef.current >= totalToLoad && totalToLoad > 0) {
        // minor delay so last textures settle visually, then finalize
        setTimeout(() => { loadTargetRef.current = 100; startProgressAnimator(); setTimeout(() => { setLoadingDone(true); setLoadProgress(100); }, 220); }, 220);
      }
    });
  }

  (function createSpritesInBatches() {
    console.time('Create sprites in batches');
    // Check if component is still valid before starting sprite creation
    if (!rendererRef.current || !sceneRef.current) {
      console.log('Skipping sprite batch creation - WebGL context not ready');
      console.timeEnd('Create sprites in batches');
      return;
    }

  const batchSize = 10; // Process 10 sprites at a time
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
      console.log(`Processing sprite batch ${i + 1}-${end} of ${total}`);
      for (let idx = i; idx < end; idx++) {
  const post = placementPosts[idx];
        if (!post || !post.image) continue;
  const key = post.slug?.current || post.slug || post._id || post.title;
        const preTex = preloadedTexturesRef.current[key];
  const onTexture = (texture, wasPreloaded = false) => {
          // Check if renderer is still valid before creating WebGL resources
          if (!rendererRef.current || !sceneRef.current) {
            console.log('Skipping sprite creation - WebGL context not ready');
            return;
          }

          try {
            const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 1 });
            const sprite = new THREE.Sprite(material);
          const baseHeight = 2.0; // Increased since we're using smaller 800px textures
          const imageAspect = texture.image.width / texture.image.height;
          
          // Relaxed sprite dimension caps since textures are now smaller (800px vs 500px+)
          const maxSpriteWidth = 3.0; // Increased from 2.0
          const maxSpriteHeight = 2.0; // Increased from 1.5
          
          let width = baseHeight * imageAspect;
          let height = baseHeight;
          
          // If width exceeds max, scale down proportionally
          if (width > maxSpriteWidth) {
            const scale = maxSpriteWidth / width;
            width = maxSpriteWidth;
            height = height * scale;
          }
          
          // If height exceeds max, scale down proportionally  
          if (height > maxSpriteHeight) {
            const scale = maxSpriteHeight / height;
            height = maxSpriteHeight;
            width = width * scale;
          }
          
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
          // progress tracking based on unique image URLs
          try {
            const url = post.image;
            if (url && !loadedUrls.has(url)) {
              loadedUrls.add(url);
              loadedCountRef.current += 1;
              scheduleProgressUpdate();
            }
          } catch (e) {
            // ignore progress tracking errors
          }
          } catch (error) {
            console.warn('Error creating sprite:', error);
          }
        };

        if (preTex) {
          onTexture(preTex, true);
        } else {
          // Images are now using thumbnails (800px) for better quality while maintaining performance
          // Use the post.image URL as the identity for progress tracking
          const imgUrl = post.image;
          console.time(`Load texture: ${imgUrl}`);
          loader.load(imgUrl, (texture) => {
            console.timeEnd(`Load texture: ${imgUrl}`);
            // Apply Three.js optimizations for better performance
            optimizeTexture(texture);
            onTexture(texture, false);
          }, undefined, (err) => {
            console.timeEnd(`Load texture: ${imgUrl}`);
            // on error, still mark URL as loaded so loader doesn't hang
            console.warn('Texture load failed for', imgUrl, err);
            try {
              if (imgUrl && !loadedUrls.has(imgUrl)) {
                loadedUrls.add(imgUrl);
                loadedCountRef.current += 1;
                scheduleProgressUpdate();
              }
            } catch (e) {}
          });
        }
      }
      i = end;
      if (i < total) {
        // yield to the main thread briefly
        setTimeout(processBatch, 10); // 10ms delay between batches
      }
    };

    processBatch();
    console.timeEnd('Create sprites in batches');
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

  // Track listeners so we can remove them during cleanup (important on iOS)
  window.addEventListener('pointermove', onPointerMove);
  listenersRef.current.push({ type: 'pointermove', handler: onPointerMove });
  window.addEventListener('pointerdown', onPointerDown);
  listenersRef.current.push({ type: 'pointerdown', handler: onPointerDown });
  window.addEventListener('pointerup', onPointerUp);
  listenersRef.current.push({ type: 'pointerup', handler: onPointerUp });

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
  listenersRef.current.push({ type: 'resize', handler: onWindowResize });

  const clickHandler = (e) => {
          // Ignore interactions until intro is dismissed
          if (!introCompleteRef.current) return;
          // Dedupe after touch-based pointerup already triggered the interaction
          if (Date.now() - lastInteractionTimeRef.current < 500) return;
          // update mouse from the click location (covers taps without prior move)
          updateMouseFromEvent(e);
          // ignore clicks that happen while dragging
          if (!isDraggingRef.current) handleInteraction();
  };
  window.addEventListener('click', clickHandler);
  listenersRef.current.push({ type: 'click', handler: clickHandler });
  window.addEventListener('pointercancel', onPointerCancel);
  listenersRef.current.push({ type: 'pointercancel', handler: onPointerCancel });

        function handleInteraction() {
          // Prevent rapid navigation that can cause WebGL context issues
          const now = Date.now();
          const timeSinceLastNav = now - lastNavigationTime.current;
          if (timeSinceLastNav < 2000) {
            console.log('Sprite navigation blocked - too soon since last navigation');
            return;
          }

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
              if (clickedSprite.parent) {
                clickedSprite.parent.remove(clickedSprite);
              }
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

            gsap.to(clickedSprite.position, { x: 0, y: 0, z: 0, duration: 1, ease: 'power2.out' });
            gsap.to(clickedSprite.scale, { x: targetWidth, y: targetHeight, duration: 1, ease: 'power2.out' });

            // Navigate with proper cleanup on iOS to prevent crashes
            const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
            lastNavigationTime.current = Date.now();

            if (isIOS) {
              // On iOS, wait for sprite animation to complete, then show loading screen
              console.log('iOS Navigation: Starting sprite animation for', slug);
              if (slug && typeof slug === 'string' && slug.trim()) {
                // Start sprite animation (position, scale, opacity)
                gsap.to(clickedSprite.material, {
                  opacity: 0, // Fade to fully transparent
                  duration: 0.8,
                  ease: 'power1.in',
                });
                
                // Show loading screen after animation completes
                setTimeout(() => {
                  setIsNavigating(true);
                  
                  // Wait for forced cleanup to complete, then navigate. Use forceDispose
                  // on iOS to attempt to free GPU memory before the page change.
                  cleanupThreeJS(true, true).then(() => {
                    console.log('iOS Navigation: Forced cleanup complete, navigating to', slug);
                    // Use location.replace instead of href for cleaner navigation
                    window.location.replace(`/posts/${slug}`);
                  }).catch((error) => {
                    console.error('iOS Navigation: Forced cleanup failed', error);
                    // Still try to navigate even if cleanup fails
                    window.location.replace(`/posts/${slug}`);
                  });
                }, 1000); // Wait for 1 second (after animation completes)
              }
            } else {
              // Non-iOS: use the original animation with cleanup
              gsap.to(clickedSprite.material, {
                opacity: 0,
                delay: 2,
                duration: 0.5,
                ease: 'power1.in',
                onComplete: () => {
                  console.log('Navigation: Starting navigation for', slug);
                  cleanupThreeJS();

                  if (slug && typeof slug === 'string' && slug.trim()) {
                    console.log('Navigation: Attempting router.push');
                      try {
                        router.push(`/posts/${slug}`);
                      } catch (error) {
                        console.error('Router push failed, trying location.assign', error);
                        window.location.assign(`/posts/${slug}`);
                      }
                  } else {
                    console.warn('Invalid slug for navigation', slug);
                  }
                },
              });
            }
          }
        }

        const clock = new THREE.Clock();
        let lastRenderTime = 0;
        const targetFPS = 30; // Reduced from 60fps to improve performance on older devices
        const frameInterval = 1000 / targetFPS; // ~33.33ms for 30fps
        
        function animate(currentTime = 0) {
          animateIdRef.current = requestAnimationFrame(animate);
          
          // Throttle to target FPS
          if (currentTime - lastRenderTime < frameInterval) {
            return; // Skip this frame
          }
          lastRenderTime = currentTime;
          
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

          // LOD (Level of Detail) and memory management for better performance
          const cameraPosition = camera.position;
          const unloadDistance = 15; // Distance at which to unload textures to save memory
          
          sprites.forEach((sprite) => {
            if (!sprite || !sprite.position) return;
            
            const distance = cameraPosition.distanceTo(sprite.position);
            
            // Unload textures for distant sprites to save GPU memory
            if (distance > unloadDistance && !sprite.userData.preloaded && sprite.material.map) {
              // Store reference to reload later if needed
              if (!sprite.userData.textureUrl) {
                sprite.userData.textureUrl = sprite.userData.imageUrl;
              }
              // Dispose texture to free memory
              sprite.material.map.dispose();
              sprite.material.map = null;
              sprite.material.needsUpdate = true;
            }
            
            // Reload texture if sprite comes close again
            if (distance < unloadDistance * 0.8 && !sprite.material.map && sprite.userData.textureUrl) {
              // Reload texture for non-preloaded sprites that came back into view
              const loader = new THREE.TextureLoader();
              loader.load(sprite.userData.textureUrl, (texture) => {
                if (sprite.material) { // Check if sprite still exists
                  optimizeTexture(texture);
                  sprite.material.map = texture;
                  sprite.material.needsUpdate = true;
                }
              });
            }
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
      cleanupThreeJS(true);
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
      >
  <div className="absolute top-0 left-0 w-full h-full" />

        {/* Loading overlay - very lightweight and throttled */}
        <div className={loadingDone ? `${styles.overlay} ${styles.hidden}` : styles.overlay} aria-hidden={loadingDone}>
          <div className={styles.loaderBox} role="status" aria-live="polite">
            <div className={styles.progressText}>{loadingDone ? 'Loaded' : `Loading 3D scene — ${loadProgress}%`}</div>
            <div className={styles.progressOuter}>
              <div className={styles.progressInner} style={{ width: `${loadProgress}%` }} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}