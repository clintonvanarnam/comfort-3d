'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useRouter } from 'next/navigation';
import { getPosts } from '@/lib/getPosts';
import gsap from 'gsap';
import NavBar from './NavBar';

export default function ThreeScene() {
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
  // sphere mode is always enabled by default
  const useSphereRef = useRef(true);
  const sphereGroupRef = useRef(null);
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const sphereRotationTargetRef = useRef({ x: 0, y: 0 });
  const hoverEnabledRef = useRef(true);

  useEffect(() => {
    let debounceTimer;
    if (hoveredInfo && (hoveredInfo.title || hoveredInfo.author)) {
      // skip hover-based speech if the user has clicked a sprite
      if (!hoverEnabledRef.current) {
        // don't speak, but still allow hover UI to update
      } else if (typeof window !== 'undefined' && window.speechSynthesis && window.SpeechSynthesisUtterance) {
        window.speechSynthesis.cancel();
        debounceTimer = setTimeout(() => {
          const utterance = new window.SpeechSynthesisUtterance();
          utterance.text = hoveredInfo.author
            ? `${hoveredInfo.title} by ${hoveredInfo.author}`
            : hoveredInfo.title;
          utterance.rate = 1.05;
          utterance.pitch = 1.1;
          window.speechSynthesis.speak(utterance);
        }, 100);
      }
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [hoveredInfo]);

  useEffect(() => {
    setMounted(true);
    // start preloading posts and textures in background
    (async function preload() {
      try {
        const posts = await getPosts();
        preloadedPostsRef.current = posts;
        const loader = new THREE.TextureLoader();
        let remaining = posts.length;
        if (!remaining) {
          preloadedDoneRef.current = true;
          return;
        }
        posts.forEach((post) => {
          if (!post.image) {
            remaining -= 1;
            if (remaining <= 0) preloadedDoneRef.current = true;
            return;
          }
          loader.load(
            post.image,
            (texture) => {
              preloadedTexturesRef.current[post.slug?.current || post.slug || post._id || post.title] = texture;
              remaining -= 1;
              if (remaining <= 0) preloadedDoneRef.current = true;
            },
            undefined,
            () => {
              // on error, still mark as done for this item
              remaining -= 1;
              if (remaining <= 0) preloadedDoneRef.current = true;
            }
          );
        });
      } catch (e) {
        console.warn('Preload failed', e);
        preloadedDoneRef.current = true;
      }
    })();
  }, []);

  // sphere mode always enabled via useSphereRef default

  useEffect(() => {
  if (!mounted || !introComplete) return;

    // Defer scene initialization to next tick so React can remove the intro overlay first
    setTimeout(() => {
      async function init() {
        // prefer preloaded posts if available
        const posts = preloadedPostsRef.current || (await getPosts());
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 5;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.setClearColor(0x000000, 1); // Set background to black
        renderer.setSize(window.innerWidth, window.innerHeight);
        if (containerRef.current) {
          containerRef.current.appendChild(renderer.domElement);
        }

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
  // random seed so sphere distribution isn't identical every load
  const sphereSeed = Math.random() * Math.PI * 2;

  posts.forEach((post, idx) => {
          if (!post.image) return;
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
              // Fibonacci sphere algorithm
              const total = posts.length || 1;
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
              // remember the original scale so we can animate back to it
              origScale: { x: sprite.scale.x, y: sprite.scale.y },
            };
            // set initial state to be small/transparent so we can animate them in with GSAP
            sprite.material.opacity = 0;
            sprite.scale.set(0.001, 0.001, 0.001);
            sprites.push(sprite);
            if (wasPreloaded) preloadedSprites.push(sprite);
            else lateSprites.push(sprite);

            // If phase1 has already completed, animate late arrivals individually
            if (phase1Done && !wasPreloaded) {
              // Phase 2 quick animation for late arrivals
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
        });

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
        function onPointerMove(event) {
          // always update mouse for accurate raycasting
          mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
          mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

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
          isDraggingRef.current = true;
          lastPointerRef.current.x = e.clientX;
          lastPointerRef.current.y = e.clientY;
        }

        function onPointerUp() {
          // small delay to allow click handlers to check dragging state
          isDraggingRef.current = false;
        }

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointerup', onPointerUp);

        window.addEventListener('click', (e) => {
          // ignore clicks that happen while dragging
          if (!isDraggingRef.current) handleInteraction();
        });

        function handleInteraction() {
          raycaster.setFromCamera(mouse, camera);
          const intersects = raycaster.intersectObjects(sprites);

          if (intersects.length > 0 && !clickedRef.current) {
            const clickedSprite = intersects[0].object;
            const { slug, imageAspect } = clickedSprite.userData;
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

            gsap.to(clickedSprite.material, {
              opacity: 0,
              delay: 2,
              duration: 0.5,
              ease: 'power1.in',
              onComplete: () => router.push(`/posts/${slug}`),
            });
          }
        }

        const clock = new THREE.Clock();
        function animate() {
          requestAnimationFrame(animate);
          const t = clock.getElapsedTime();

          // Orbital camera: full rotation around the sphere based on mouse
          const radius = 8;
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
  }, [mounted, introComplete, router]);

  if (!mounted) return null;

  if (!introComplete) {
    return (
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
        width: '100vw',
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'black',
        position: 'relative',
        color: 'white',
        fontFamily: 'monospace',
        fontSize: '24px',
        cursor: 'none',
      }}
      >
      <img
        src="/COMFORT_MAG_LOGO_WHITE.svg"
        alt="Comfort Logo"
        style={{
        maxWidth: '80%',
        maxHeight: '50%',
        opacity: introFading ? 0 : 1,
        transition: 'opacity 0.4s',
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
        zIndex: 2147483647,
        display: introCursor.visible ? 'block' : 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        mixBlendMode: 'difference',
        }}
      >
        [CLICK]
      </div>
      </div>
    );
  }

  return (
    <>
  <NavBar />
      <div
        ref={containerRef}
        style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: 'black' }}
      />
  {/* sphere mode always on; toggle removed */}
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