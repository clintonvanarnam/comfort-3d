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
  const canvasRef = useRef(null);
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
  // Removed: hoverEnabledRef (speech/hover speech feature deprecated)
  // Refs for Three.js resources to enable cleanup
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const animateIdRef = useRef(null);

  const isInitializingRef = useRef(false);
  const preloadStartedRef = useRef(false);
  const lastNavigationTime = useRef(0);
  const cleanupPerformedRef = useRef(false);
  const domRemovalObserverRef = useRef(null);
  const tapCountRef = useRef(0);
  const tapTimeoutRef = useRef(null);
  const lastTappedSpriteRef = useRef(null);
  const ignorePointerEventsUntilRef = useRef(0);

  // Sound system
  const [soundEnabled, setSoundEnabled] = useState(false);
  const synthRef = useRef(null);
  const reverbRef = useRef(null);
  const audioInitializedRef = useRef(false);
  const soundEnabledRef = useRef(false);
  const lastHoveredTitleRef = useRef(null);
  const lastMobileSoundTimeRef = useRef(0);

  // Window size tracking for responsive button positioning
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  // Debug mode for mobile click testing
  const [debugMode, setDebugMode] = useState(false);
  const [debugMousePos, setDebugMousePos] = useState({ x: 0, y: 0 });

  // Pentatonic minor scale notes (A minor pentatonic across 2 octaves)
  const pentatonicScale = ['A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5'];

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
    // Prevent multiple cleanups
    if (cleanupPerformedRef.current) {
      return;
    }

    // Detect iOS for more conservative cleanup
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

    cleanupPerformedRef.current = true;

    if (animateIdRef.current) {
      cancelAnimationFrame(animateIdRef.current);
      animateIdRef.current = null;
    }

    // Reset initialization flag
    isInitializingRef.current = false;

    // On iOS, be conservative by default to avoid context loss issues, but allow
    // a forced disposal when navigation requires releasing memory (forceDispose)
    if (isIOS && !forceDispose) {
      // Just stop the animation loop, let WebGL context die naturally with page unload
      await new Promise(resolve => setTimeout(resolve, 100));
      return;
    }

    if (rendererRef.current) {
      try {
        // Skip canvas removal - let React handle DOM cleanup to prevent race conditions
        // Attempt to lose the context to free GPU memory
        if (rendererRef.current.forceContextLoss) {
          try { rendererRef.current.forceContextLoss(); } catch (e) {}
        }
        rendererRef.current.dispose();
      } catch (e) {
        // Error disposing renderer
      }
      rendererRef.current = null;
    }

    if (sceneRef.current) {
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

    // Clear any pending tap timeout
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
    }

    // Clean up audio
    cleanupAudio();

    // Wait a bit to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 50));
  };

  // Audio functions
  const initializeAudio = async () => {
    if (audioInitializedRef.current) return;
    
    try {
      // Dynamically import Tone.js only when needed
      const Tone = await import('tone');
      
      // Start Tone.js audio context (requires user interaction)
      await Tone.start();
      
      // Create a reverb effect
      reverbRef.current = new Tone.Reverb({
        decay: 5.5,
        wet: 0.7,
        preDelay: 0.1
      }).toDestination();
      
      // Create a simple synth connected to reverb
      synthRef.current = new Tone.Synth({
        oscillator: {
          type: 'sine'
        },
        envelope: {
          attack: 0.2,
          decay: 0.3,
          sustain: 0.4,
          release: 0.9
        },
        volume: -4 // Make it quieter
      }).connect(reverbRef.current);

      audioInitializedRef.current = true;
    } catch (error) {
      // Failed to initialize audio
      throw error;
    }
  };

  const playNote = (noteIndex = null) => {
    
    if (!soundEnabled) {
      return;
    }
    
    if (!synthRef.current) {
      return;
    }
    
    try {
      // If no specific note provided, pick a random one from pentatonic scale
      const index = noteIndex !== null ? noteIndex : Math.floor(Math.random() * pentatonicScale.length);
      const note = pentatonicScale[index % pentatonicScale.length];
      
      // Play the note with a short duration
      synthRef.current.triggerAttackRelease(note, '8n');
    } catch (error) {
      // Failed to play note
    }
  };

  // Play random sound during mobile interactions (throttled)
  const playMobileInteractionSound = () => {
    const now = Date.now();
    // Throttle mobile sounds to every 300ms to avoid overwhelming audio
    if (now - lastMobileSoundTimeRef.current < 300) return;
    
    if (soundEnabledRef.current && synthRef.current) {
      try {
        // Play a random note from the pentatonic scale
        const randomIndex = Math.floor(Math.random() * pentatonicScale.length);
        const note = pentatonicScale[randomIndex];
        synthRef.current.triggerAttackRelease(note, '0.08'); // Shorter duration for mobile
        lastMobileSoundTimeRef.current = now;
      } catch (error) {
        // Failed to play mobile interaction note
      }
    }
  };

  const toggleSound = async () => {
    
    if (!soundEnabled) {
      try {
        // Initialize audio when first enabling
        await initializeAudio();
        setSoundEnabled(true);
        // Play a welcome note
        setTimeout(() => playNote(0), 100);
      } catch (error) {
        // Failed to enable sound
      }
    } else {
      setSoundEnabled(false);
    }
  };

  const cleanupAudio = () => {
    try {
      if (synthRef.current) {
        synthRef.current.dispose();
        synthRef.current = null;
      }
      if (reverbRef.current) {
        reverbRef.current.dispose();
        reverbRef.current = null;
      }
      audioInitializedRef.current = false;
    } catch (error) {
      // Audio cleanup error
    }
  };

  useEffect(() => {
    // keep a ref in sync so event listeners inside the scene can check
    // whether the intro overlay has been dismissed without stale closures
    introCompleteRef.current = introComplete;
  }, [introComplete]);

  useEffect(() => {
    // Keep soundEnabledRef in sync with soundEnabled state to avoid stale closures
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    // Handle window resize for responsive button positioning with debouncing
    let resizeTimeout;
    const handleResize = () => {
      // Clear previous timeout
      clearTimeout(resizeTimeout);
      // Set new timeout to debounce the resize event
      resizeTimeout = setTimeout(() => {
        setWindowWidth(window.innerWidth);
      }, 100); // 100ms debounce
    };

    window.addEventListener('resize', handleResize);
    
    // Cleanup listener and timeout on unmount
    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

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
    
    // Check for debug mode URL parameter
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      setDebugMode(urlParams.has('debug'));
    }
    
    // add a body class so other parts of the UI (like the footer) can
    // respond to the 3D-scene being active and hide UI that shouldn't overlay.
    if (typeof document !== 'undefined') document.body.classList.add('three-scene-active');
    // Development-only: observe DOM removals to help debug race conditions
    try {
      if (process.env.NODE_ENV === 'development' && typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
        if (!domRemovalObserverRef.current) {
          const obs = new MutationObserver((mutations) => {
            for (const m of mutations) {
              if (m.removedNodes && m.removedNodes.length) {
                for (const n of m.removedNodes) {
                  try {
                    if (n && n.nodeType === 1) {
                      // Capture a stack to help identify the removal caller
                      const stack = (new Error('DOM removal trace')).stack;
                      try {
                        // [DOM-REMOVAL-DEBUG] removed node
                      } catch (e) {
                        // ignore logging errors
                      }
                    }
                  } catch (e) {}
                }
              }
            }
          });
          try {
            obs.observe(document, { childList: true, subtree: true });
            domRemovalObserverRef.current = obs;
            // [DOM-REMOVAL-DEBUG] observer installed
          } catch (e) {
            // ignore observer install errors
          }
        }
      }
    } catch (e) {}
    // start preloading posts and textures in the background with limited concurrency
    (async function preload() {
      if (preloadStartedRef.current) return;
      preloadStartedRef.current = true;
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
            // Images are now using thumbnails (800px) for better quality while maintaining performance
            loader.load(url, (tex) => {
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
        // Preload textures completed
      } catch (e) {
        // Preload failed
        preloadedDoneRef.current = true;
      }
    })();

    return () => {
      if (typeof document !== 'undefined') document.body.classList.remove('three-scene-active');
      // Clean up audio resources
      cleanupAudio();
      // disconnect the dev MutationObserver if present
      try {
        if (domRemovalObserverRef.current) {
          try { domRemovalObserverRef.current.disconnect(); } catch (e) {}
          domRemovalObserverRef.current = null;
          // [DOM-REMOVAL-DEBUG] observer disconnected
        }
      } catch (e) {}
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
      return;
    }
    isInitializingRef.current = true;
    cleanupPerformedRef.current = false; // Reset cleanup flag on new initialization

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
    camera.position.set(0, 0, 100);

  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvasRef.current || undefined });
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
        // If we have a React-managed canvas, the renderer will already use it.
        // Fallback: append the renderer.domElement into the container if canvasRef isn't present.
        if (!canvasRef.current) {
          try {
            if (containerRef.current) containerRef.current.appendChild(renderer.domElement);
          } catch (e) {}
        } else {
          // ensure touchAction is disabled for the managed canvas
          try { canvasRef.current.style.touchAction = 'none'; } catch (e) {}
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
    // Check if component is still valid before starting sprite creation
    if (!rendererRef.current || !sceneRef.current) {
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
      // Processing sprite batch ${i + 1}-${end} of ${total}
      for (let idx = i; idx < end; idx++) {
  const post = placementPosts[idx];
        if (!post || !post.image) continue;
  const key = post.slug?.current || post.slug || post._id || post.title;
        const preTex = preloadedTexturesRef.current[key];
  const onTexture = (texture, wasPreloaded = false) => {
          // Check if renderer is still valid before creating WebGL resources
          if (!rendererRef.current || !sceneRef.current) {
            return;
          }

          // Safety check: ensure texture is valid and loaded
          if (!texture || !texture.image) {
            // Skipping sprite creation - invalid texture
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
            // Responsive sphere radius: 4.5 on narrow/mobile, up to 6 on desktop.
            // We interpolate between 4.5 (<=640px) and 6 (>=1200px) for smoother scaling.
            let vw = (typeof window !== 'undefined') ? window.innerWidth : 1200;
            const minW = 640; // mobile breakpoint lower bound
            const maxW = 1200; // desktop upper bound for interpolation
            const t = Math.max(0, Math.min(1, (vw - minW) / (maxW - minW)));
            const sphereRadius = 4.5 + (5.5 - 4.5) * t; // lerp
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
            // Error creating sprite
          }
        };

        if (preTex) {
          onTexture(preTex, true);
        } else {
          // Images are now using thumbnails (800px) for better quality while maintaining performance
          // Use the post.image URL as the identity for progress tracking
          const imgUrl = post.image;
          loader.load(imgUrl, (texture) => {
            // Apply Three.js optimizations for better performance
            optimizeTexture(texture);
            onTexture(texture, false);
          }, undefined, (err) => {
            // on error, still mark URL as loaded so loader doesn't hang
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
    // Create sprites in batches completed
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
          
          // Update debug mouse position if debug mode is enabled
          if (debugMode) {
            setDebugMousePos({ x: mouse.x, y: mouse.y });
          }
        }

        function onPointerMove(event) {
          // Ignore pointer events for a short time after sound button interaction
          if (Date.now() < ignorePointerEventsUntilRef.current) return;
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
            // Require larger movement AND time delay for intentional rotation
            const timeSinceDown = Date.now() - pointerDownTimeRef.current;
            if (dist > 35 && timeSinceDown > 200) { // Increased from 18px and added 200ms delay
              touchMovedRef.current = true;
              isDraggingRef.current = true;
              // dramatically reduce multipliers for touch so mobile rotation is much slower
              const touchYFactor = 0.0008; // far slower than mouse
              const touchXFactor = 0.0006;
              sphereRotationTargetRef.current.y += dx * touchYFactor;
              sphereRotationTargetRef.current.x += dy * touchXFactor;
              lastPointerRef.current.x = event.clientX;
              lastPointerRef.current.y = event.clientY;
              
              // Play random sound during mobile drag interaction
              playMobileInteractionSound();
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
            const currentTitle = hovered.userData.title;
            
            // Hover detected
            
            // Play a subtle hover sound only if this is a new hover
            if (lastHoveredTitleRef.current !== currentTitle) {
              // New hover detected, attempting to play sound
              
              // Update the ref immediately to prevent multiple plays
              lastHoveredTitleRef.current = currentTitle;
              
              // Check sound state using ref to avoid stale closure
              if (soundEnabledRef.current && synthRef.current) {
                try {
                  // Play a random note from the pentatonic minor scale
                  const randomIndex = Math.floor(Math.random() * pentatonicScale.length);
                  const note = pentatonicScale[randomIndex];
                  // Playing hover note
                  synthRef.current.triggerAttackRelease(note, '0.1');
                } catch (error) {
                  // Failed to play hover note
                }
              } else {
                // Sound disabled or no synth, skipping hover sound
              }
            } else {
              // Same sprite hovered, not playing sound again
            }
            
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
            lastHoveredTitleRef.current = null;
            setHoveredInfo(null);
          }
        }

        function onPointerDown(e) {
          // Ignore pointer events for a short time after sound button interaction
          if (Date.now() < ignorePointerEventsUntilRef.current) return;
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
          // Ignore pointer events for a short time after sound button interaction
          if (Date.now() < ignorePointerEventsUntilRef.current) return;
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

            // Handle double tap for mobile - must be on the same sprite
            updateMouseFromEvent(e);
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();
            
            // Get current mouse coordinates
            if (renderer && renderer.domElement) {
              const rect = renderer.domElement.getBoundingClientRect();
              const x = (e.clientX - rect.left) / rect.width;
              const y = (e.clientY - rect.top) / rect.height;
              mouse.x = x * 2 - 1;
              mouse.y = -(y * 2 - 1);
            }
            
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(sprites);
            const currentSprite = intersects.length > 0 ? intersects[0].object : null;
            
            tapCountRef.current += 1;
            if (tapCountRef.current === 1) {
              // First tap - record which sprite was tapped
              lastTappedSpriteRef.current = currentSprite;
              if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
              tapTimeoutRef.current = setTimeout(() => {
                tapCountRef.current = 0;
                lastTappedSpriteRef.current = null;
              }, 300); // 300ms window for double tap
            } else if (tapCountRef.current === 2) {
              // Second tap - check if it's the same sprite
              if (currentSprite && currentSprite === lastTappedSpriteRef.current) {
                // Double tap on same sprite detected
                if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
                tapCountRef.current = 0;
                lastTappedSpriteRef.current = null;
                lastInteractionTimeRef.current = Date.now();
                handleInteraction(true); // Pass true to indicate mobile double-tap
              } else {
                // Different sprite or no sprite - reset and treat as first tap
                tapCountRef.current = 1;
                lastTappedSpriteRef.current = currentSprite;
                if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
                tapTimeoutRef.current = setTimeout(() => {
                  tapCountRef.current = 0;
                  lastTappedSpriteRef.current = null;
                }, 300);
              }
            }

            touchMovedRef.current = false;
            isDraggingRef.current = false;
            return;
          }

          // small delay to allow click handlers to check dragging state for mouse/pen
          isDraggingRef.current = false;
        }

        function onPointerCancel(e) {
          // Ignore pointer events for a short time after sound button interaction
          if (Date.now() < ignorePointerEventsUntilRef.current) return;
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

        function handleInteraction(fromMobileDoubleTap = false) {
          // Prevent rapid navigation that can cause WebGL context issues
          const now = Date.now();
          const timeSinceLastNav = now - lastNavigationTime.current;
          if (timeSinceLastNav < 2000) {
            // Sprite navigation blocked - too soon since last navigation
            return;
          }

          raycaster.setFromCamera(mouse, camera);
          const intersects = raycaster.intersectObjects(sprites);

          // Debug mode: show click coordinates and intersect results
          if (debugMode) {
            console.log('🎯 Debug Click Info:', {
              mouseCoords: { x: mouse.x, y: mouse.y },
              intersectsFound: intersects.length,
              clickedTitle: intersects.length > 0 ? intersects[0].object.userData.title : 'None',
              allIntersects: intersects.map((hit, i) => ({
                index: i,
                title: hit.object.userData.title,
                distance: hit.distance
              })),
              interactionType: fromMobileDoubleTap ? 'mobile-double-tap' : 'desktop-click'
            });

            // In debug mode, only highlight on proper interaction (desktop click OR mobile double-tap)
            if (intersects.length > 0) {
              const clickedSprite = intersects[0].object;
              
              // Reset all sprites to normal color first
              sprites.forEach(sprite => {
                if (sprite.material && sprite.material.color) {
                  sprite.material.color.setHex(0xffffff); // white (normal)
                }
              });
              
              // Highlight the clicked sprite in bright white/yellow
              if (clickedSprite.material && clickedSprite.material.color) {
                clickedSprite.material.color.setHex(0xffff00); // bright yellow for visibility
              }
              
              console.log('🟡 Highlighted sprite:', clickedSprite.userData.title);
            }
            return; // Exit early in debug mode - don't navigate
          }

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

            // Removed text-to-speech feature (client request)

            sprites.forEach(sprite => sprite.userData.floating = false);

            sprites.forEach((sprite) => {
              if (sprite !== clickedSprite) {
                gsap.to(sprite.position, { y: sprite.position.y - 10, duration: 1, ease: 'power2.in' });
                gsap.to(sprite.material, { opacity: 0, duration: 0.8, ease: 'power1.out' });
              }
            });

            const targetHeight = 2;
            const targetWidth = targetHeight * imageAspect;

            gsap.to(clickedSprite.position, { x: 0, y: 0, z: 0, duration: 0.8, ease: 'power2.out' });
            gsap.to(clickedSprite.scale, { 
              x: targetWidth, 
              y: targetHeight, 
              duration: 0.8, 
              ease: 'power2.out',
              onComplete: () => {
                if (slug && typeof slug === 'string' && slug.trim()) {
                  try {
                    router.push(`/posts/${slug}`);
                  } catch (e) {
                    try { window.location.href = `/posts/${slug}`; } catch (_) {}
                  }
                }
              }
            });

            // Navigate with proper cleanup on iOS to prevent crashes
            const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
            lastNavigationTime.current = Date.now();

            // Removed fade-out: navigate immediately after centering/scale completes
          }
        }

        const clock = new THREE.Clock();
        let lastRenderTime = 0;
        const targetFPS = 60; // Restored to 60fps
        const frameInterval = 1000 / targetFPS; // ~16.67ms for 60fps
        
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
            // TEMPORARILY DISABLED to debug white rectangle issue
            /*
            if (distance > unloadDistance && !sprite.userData.preloaded && sprite.material.map) {
              // Unloading texture for distant sprite
              // Store reference to reload later if needed
              if (!sprite.userData.textureUrl) {
                sprite.userData.textureUrl = sprite.userData.imageUrl;
              }
              // Dispose texture to free memory
              sprite.material.map.dispose();
              sprite.material.map = null;
              sprite.material.needsUpdate = true;
            }
            */
            
            // Reload texture if sprite comes close again
            // TEMPORARILY DISABLED to debug white rectangle issue
            /*
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
            */
          });

          // rotate sphere group based on rotation target (drag to rotate) with a light auto-rotate
          if (useSphereRef.current && sphereGroupRef.current) {
            const sphereGroup = sphereGroupRef.current;
            // gentle auto-rotation when not interacting
            if (!isDraggingRef.current) {
              sphereRotationTargetRef.current.y += 0.0022; // auto spin
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

      {/* Sound toggle button - typography matching SHOP and ABOUT */}
      <div 
        style={{
          position: 'absolute',
          // Desktop: top left, Mobile: bottom left
          ...(windowWidth <= 768 ? {
            bottom: '1rem',
            left: '1rem',
            top: 'auto',
            padding: '0.25rem 0'
          } : {
            top: '1rem',
            left: '1rem',
            bottom: 'auto',
            padding: '0.5rem 1rem'
          }),
          zIndex: 9999999999,
          color: '#fff',
          fontFamily: 'var(--font-monument)',
          fontWeight: 700,
          fontSize: '0.9rem',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        
          textDecoration: soundEnabled ? 'underline' : 'none',
        }}
        onClick={(e) => {
          e.stopPropagation();
          // Reset all touch/pointer state to prevent interference with sprite interactions
          tapCountRef.current = 0;
          lastTappedSpriteRef.current = null;
          if (tapTimeoutRef.current) {
            clearTimeout(tapTimeoutRef.current);
            tapTimeoutRef.current = null;
          }
          touchMovedRef.current = false;
          touchHoldActiveRef.current = false;
          isDraggingRef.current = false;
          if (touchHoldTimerRef.current) {
            clearTimeout(touchHoldTimerRef.current);
            touchHoldTimerRef.current = null;
          }
          // Ignore pointer events for 500ms after sound button interaction
          ignorePointerEventsUntilRef.current = Date.now() + 500;
          toggleSound();
        }}
        title={soundEnabled ? "Turn sound off" : "Turn sound on"}
      >
        {soundEnabled ? 'SOUND ON' : 'SOUND OFF'}
      </div>

      {/* Canvas container - always mounted so scene can initialize and load assets */}
      <div
        ref={containerRef}
        style={{ 
          width: '100vw', 
          height: 'calc(100vh + env(safe-area-inset-bottom))', 
          overflow: 'hidden', 
          background: 'black', 
          position: 'relative'
        }}
      >
  <div className="absolute top-0 left-0 w-full h-full" />
        {/* React-managed canvas for Three.js to reduce direct DOM mutations */}
        <canvas
          ref={canvasRef}
          className="three-scene-canvas"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
          aria-hidden={true}
        />

        {/* Loading overlay - very lightweight and throttled */}
        <div className={loadingDone ? `${styles.overlay} ${styles.hidden}` : styles.overlay} aria-hidden={loadingDone}>
          <div className={styles.loaderBox} role="status" aria-live="polite">
            <img src="/COMFORT_MAG_LOGO_WHITE.svg" alt="Comfort Magazine Logo" className={styles.logo} />
            <div className={styles.progressText}>{loadingDone ? 'Loaded' : `Loading 3D scene — ${loadProgress}%`}</div>
            <div className={styles.progressOuter}>
              <div className={styles.progressInner} style={{ width: `${loadProgress}%` }} />
            </div>
          </div>
        </div>

        {/* Hover info display */}
        {hoveredInfo && (
          <div className={styles.hoverInfo}>
            <div className={styles.hoverTitle}>{hoveredInfo.title}</div>
            <div className={styles.hoverAuthor}>{hoveredInfo.author}</div>
          </div>
        )}

        {/* Debug mode indicator */}
        {debugMode && (
          <div style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'rgba(255, 0, 0, 0.8)',
            color: 'white',
            padding: '0.5rem',
            borderRadius: '4px',
            fontSize: '0.8rem',
            fontFamily: 'monospace',
            zIndex: 9999999999
          }}>
            🐛 DEBUG MODE
            <br />
            Check console for click info
            <br />
            Mouse: {debugMousePos.x.toFixed(2)}, {debugMousePos.y.toFixed(2)}
          </div>
        )}
      </div>
    </>
  );
}