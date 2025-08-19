'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useRouter } from 'next/navigation';
import { getPosts } from '@/lib/getPosts';
import gsap from 'gsap';

export default function Home() {
  const [mounted, setMounted] = useState(false);
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
            Math.random() * 8 - 4,
            Math.random() * -2 + 2,
            Math.random() * -2 + 2
          );

          sprite.userData = {
            slug: post.slug.current,
            floatPhase: Math.random() * Math.PI * 2,
            floatSpeed: 0.5 + Math.random(),
            floatAmplitude: 0.2 + Math.random() * 0.3,
            baseY: sprite.position.y,
            floating: true,
            imageAspect,
          };

          scene.add(sprite);
          sprites.push(sprite);
        });
      });

      // Mouse movement for desktop
      window.addEventListener('mousemove', (event) => {
        if (!clickedRef.current) {
          mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
          mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

          raycaster.setFromCamera(mouse, camera);
          const intersects = raycaster.intersectObjects(sprites);
          containerRef.current.style.cursor =
            intersects.length > 0 ? 'pointer' : 'default';
        }
      });

      // Touch movement for mobile
      window.addEventListener('touchmove', (event) => {
        if (!clickedRef.current && event.touches.length === 1) {
          const touch = event.touches[0];
          mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
          mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;

          raycaster.setFromCamera(mouse, camera);
          const intersects = raycaster.intersectObjects(sprites);
          containerRef.current.style.cursor =
            intersects.length > 0 ? 'pointer' : 'default';
        }
      });

      // Click for desktop
      window.addEventListener('click', (event) => {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(sprites);

        if (intersects.length > 0 && !clickedRef.current) {
          const clickedSprite = intersects[0].object;
          const { slug, imageAspect } = clickedSprite.userData;
          clickedRef.current = clickedSprite;

          // Disable floating for all
          sprites.forEach((sprite) => {
            sprite.userData.floating = false;
          });

          // Animate other sprites to fall down
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

          // Animate clicked sprite to center (preserving aspect ratio)
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
            delay: 1,
            duration: 0.5,
            ease: 'power1.in',
            onComplete: () => {
              router.push(`/posts/${clickedSprite.userData.slug}`);
            },
          });
        }
      });

      // Tap for mobile
      window.addEventListener('touchend', (event) => {
        if (!clickedRef.current && event.changedTouches.length === 1) {
          const touch = event.changedTouches[0];
          mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
          mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;

          raycaster.setFromCamera(mouse, camera);
          const intersects = raycaster.intersectObjects(sprites);
          if (intersects.length > 0) {
            const clickedSprite = intersects[0].object;
            const { slug, imageAspect } = clickedSprite.userData;
            clickedRef.current = clickedSprite;

            // Disable floating for all
            sprites.forEach((sprite) => {
              sprite.userData.floating = false;
            });

            // Animate other sprites to fall down
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

            // Animate clicked sprite to center (preserving aspect ratio)
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
              delay: 1,
              duration: 0.5,
              ease: 'power1.in',
              onComplete: () => {
                router.push(`/posts/${clickedSprite.userData.slug}`);
              },
            });
          }
        }
      });

      const clock = new THREE.Clock();

      function animate() {
        requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        sprites.forEach((sprite) => {
          if (sprite.userData.floating) {
            sprite.position.y =
              sprite.userData.baseY +
              Math.sin(
                t * sprite.userData.floatSpeed + sprite.userData.floatPhase
              ) *
                sprite.userData.floatAmplitude;
          }
        });

        const cameraIntensity = 10; // try 3 or 5 for more movement

if (!clickedRef.current) {
  camera.position.x += (mouse.x * cameraIntensity - camera.position.x) * 0.1;
  camera.position.y += (mouse.y * cameraIntensity - camera.position.y) * 0.1;
} 
else {
          // Animate camera to center if needed
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
    <div
      ref={containerRef}
      style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}
    />
  );
}