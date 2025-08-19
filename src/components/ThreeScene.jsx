'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useRouter } from 'next/navigation';
import { getPosts } from '@/lib/getPosts';
import gsap from 'gsap';

export default function ThreeScene() {
  const [mounted, setMounted] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState(null);
  const [hoveredInfo, setHoveredInfo] = useState(null); // {title, author}
  // Speak hovered info aloud
  useEffect(() => {
    let debounceTimer;
    if (hoveredInfo && (hoveredInfo.title || hoveredInfo.author)) {
      if (typeof window !== 'undefined' && window.speechSynthesis && window.SpeechSynthesisUtterance) {
        window.speechSynthesis.cancel(); // Stop previous utterances immediately
        debounceTimer = setTimeout(() => {
          const utterance = new window.SpeechSynthesisUtterance();
          utterance.text = hoveredInfo.author
            ? `${hoveredInfo.title} by ${hoveredInfo.author}`
            : hoveredInfo.title;
          utterance.rate = 1.05;
          utterance.pitch = 1.1;
          window.speechSynthesis.speak(utterance);
          console.log('Speaking:', utterance.text);
        }, 100); // 100ms debounce
      } else {
        console.warn('Speech Synthesis API not available');
      }
    }
    // Optionally stop speaking when not hovering
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [hoveredInfo]);
  const containerRef = useRef();
  const router = useRouter();
  const clickedRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    async function init() {
      const posts = await getPosts();
      console.log('Fetched posts array:', posts); // Debug log
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      camera.position.z = 5;

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.setSize(window.innerWidth, window.innerHeight);
      containerRef.current.appendChild(renderer.domElement);

      const loader = new THREE.TextureLoader();
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      const sprites = [];

      posts.forEach((post) => {
        loader.load(post.image, (texture) => {
          console.log('Creating sprite for post:', post); // Debug log
          texture.colorSpace = THREE.SRGBColorSpace;
          const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 1,
          });

          const sprite = new THREE.Sprite(material);
          const baseHeight = 1.5;
          const imageAspect = texture.image.width / texture.image.height;
          const width = baseHeight * imageAspect;
          const height = baseHeight;

          sprite.scale.set(width, height, 1);
          sprite.position.set(
            Math.random() * 8 - 4, // tighter x range
            Math.random() * 10 - 5, // wider y range (-3 to 3)
            Math.random() * -2 + 2 // keep z similar
          );

          // Defensive check for title
          const spriteTitle = typeof post.title === 'string' ? post.title : '';
          console.log('Assigning sprite title:', spriteTitle);

          sprite.userData = {
            slug: post.slug?.current || post.slug,
            title: spriteTitle,
            author: post.author || '',
            floatPhase: Math.random() * Math.PI * 2,
            floatSpeed: 0.5 + Math.random(),
            floatAmplitude: 0.2 + Math.random() * 0.3,
            baseY: sprite.position.y,
            floating: true,
            imageAspect,
            preloaded: false,
          };

          scene.add(sprite);
          sprites.push(sprite);
        });
      });

      window.addEventListener('mousemove', (event) => {
        if (!clickedRef.current) {
          mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
          mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

          raycaster.setFromCamera(mouse, camera);
          const intersects = raycaster.intersectObjects(sprites);
          containerRef.current.style.cursor =
            intersects.length > 0 ? 'pointer' : 'default';

          sprites.forEach(sprite => {
            // Reset all sprites to base z and scale 1
            gsap.to(sprite.position, { z: 0, duration: 0.3, overwrite: 'auto' });
            gsap.to(sprite.scale, {
              x: sprite.userData.imageAspect * 1.5,
              y: 1.5,
              duration: 0.3,
              overwrite: 'auto',
            });
          });

          if (intersects.length > 0) {
            const hovered = intersects[0].object;
            const slug = hovered.userData.slug;
            // Animate hovered sprite forward and scale up by 1.1
            gsap.to(hovered.position, { z: 1.5, duration: 0.3, overwrite: 'auto' });
            gsap.to(hovered.scale, {
              x: hovered.userData.imageAspect * 1.5 * 1.1,
              y: 1.5 * 1.1,
              duration: 0.3,
              overwrite: 'auto',
            });
            setHoveredInfo({
              title: hovered.userData.title,
              author: hovered.userData.author,
            });
            if (!hovered.userData.preloaded) {
              console.log(`Prefetching route: /posts/${slug}`);
              router.prefetch(`/posts/${slug}`);
              hovered.userData.preloaded = true;
            }
          } else {
            setHoveredInfo(null);
          }
        }
      });

      window.addEventListener('touchmove', (event) => {
        if (!clickedRef.current && event.touches.length === 1) {
          const touch = event.touches[0];
          mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
          mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;

          raycaster.setFromCamera(mouse, camera);
          const intersects = raycaster.intersectObjects(sprites);
          if (intersects.length > 0) {
            const hovered = intersects[0].object;
            const slug = hovered.userData.slug;
            if (!hovered.userData.preloaded) {
              router.prefetch(`/posts/${slug}`);
              hovered.userData.preloaded = true;
            }
          }
        }
      });

      window.addEventListener('click', () => handleInteraction());
      window.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) handleInteraction();
      });

      function handleInteraction() {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(sprites);

        if (intersects.length > 0 && !clickedRef.current) {
    const clickedSprite = intersects[0].object;
    const { slug, imageAspect } = clickedSprite.userData;
    clickedRef.current = clickedSprite;

  console.log('Clicked Sprite userData:', clickedSprite.userData);
  setSelectedTitle(clickedSprite.userData.title);
  console.log('Selected Title:', clickedSprite.userData.title);

          sprites.forEach((sprite) => {
            sprite.userData.floating = false;
          });

          sprites.forEach((sprite) => {
            if (sprite !== clickedSprite) {
              gsap.to(sprite.position, {
                y: sprite.position.y - 10,
                duration: 1,
                ease: 'power2.in',
              });
              gsap.to(sprite.material, {
                opacity: 0,
                duration: 0.8,
                ease: 'power1.out',
              });
            }
          });

          const targetHeight = 2;
          const targetWidth = targetHeight * imageAspect;

          gsap.to(clickedSprite.position, {
            x: 0,
            y: 0,
            z: 2,
            duration: 1,
            ease: 'power2.out',
          });

          gsap.to(clickedSprite.scale, {
            x: targetWidth,
            y: targetHeight,
            duration: 1,
            ease: 'power2.out',
          });

          gsap.to(clickedSprite.material, {
            opacity: 0,
            delay: 2,
            duration: 0.5,
            ease: 'power1.in',
            onComplete: () => {
              router.push(`/posts/${slug}`);
            },
          });
        }
      }

      const clock = new THREE.Clock();
      function animate() {
        requestAnimationFrame(animate);

        // Only camera movement and rendering, no sprite floating
        const intensity = 12;
        if (!clickedRef.current) {
          camera.position.x += (mouse.x * intensity - camera.position.x) * 0.1;
          camera.position.y += (mouse.y * intensity - camera.position.y) * 0.1;
        } else {
          camera.position.x += (0 - camera.position.x) * 0.1;
          camera.position.y += (0 - camera.position.y) * 0.1;
        }

        camera.lookAt(scene.position);
        renderer.render(scene, camera);
      }

      animate();
    }

    init();
  }, [mounted, router]);

  if (!mounted) return null;

  return (
    <>
      <div
        ref={containerRef}
        style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}
      />
      {hoveredInfo && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            width: '100%',
            textAlign: 'center',
            fontSize: '1.5rem',
            fontFamily: 'monospace',
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
              by {hoveredInfo.author}
            </span>
          )}
        </div>
      )}
    </>
  );
}