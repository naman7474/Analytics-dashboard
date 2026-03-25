"use client";

import React, { useEffect, useRef } from "react";

export function SignInIllustration() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (!svgRef.current) return;
          
          const svg = svgRef.current;
          const mouseX = e.clientX;
          const mouseY = e.clientY;

          // 1. ALL EYES TRACK CURSOR
          const eyes = svg.querySelectorAll('.eye-group') as NodeListOf<SVGGElement>;
          eyes.forEach(eye => {
              const pupil = eye.querySelector('.pupil') as SVGCircleElement | null;
              if (!pupil) return;
              const rect = eye.getBoundingClientRect();
              const eyeX = rect.left + rect.width / 2;
              const eyeY = rect.top + rect.height / 2;

              const dx = mouseX - eyeX;
              const dy = mouseY - eyeY;
              const angle = Math.atan2(dy, dx);
              
              // Constrain pupil inside the white of the eye perfectly
              const maxDist = rect.width / 4; 
              const dist = Math.min(maxDist, Math.hypot(dx, dy) / 12);

              const moveX = Math.cos(angle) * dist;
              const moveY = Math.sin(angle) * dist;

              pupil.style.transform = `translate(${moveX}px, ${moveY}px)`;
          });

          // 2. FACES PARALLAX (Simulates 3D head turning)
          const faces = svg.querySelectorAll('.face-group') as NodeListOf<SVGGElement>;
          faces.forEach(face => {
              const factor = parseFloat(face.getAttribute('data-parallax') || '20');
              const rect = face.getBoundingClientRect();
              const faceX = rect.left + rect.width / 2;
              const faceY = rect.top + rect.height / 2;

              const dx = mouseX - faceX;
              const dy = mouseY - faceY;

              const moveX = dx / factor;
              const moveY = dy / factor;
              
              // Clamp movement so the face doesn't slide off the character's body
              const clampedX = Math.max(-12, Math.min(12, moveX));
              const clampedY = Math.max(-8, Math.min(8, moveY));

              face.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
          });
      };

      window.addEventListener("mousemove", handleMouseMove);
      return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="relative w-full aspect-square max-w-[500px] flex items-center justify-center">
      <style dangerouslySetInnerHTML={{__html: `
        /* --- CUTE FACE STYLES --- */
        .color-dark  { fill: #1E1E2F; stroke: #1E1E2F; }
        .color-white { fill: #FFFFFF; }
        .color-blush { fill: #1E1E2F; opacity: 0.15; }
        .pupil       { fill: #1E1E2F; transition: transform 0.05s linear; }
        .face-group  { transition: transform 0.15s ease-out; }

        /* --- TEXT STYLES --- */
        .ab-label {
            font-size: 28px;
            font-weight: 900;
            fill: #FFFFFF;
            opacity: 0.9;
        }

        /* --- ANIMATIONS --- */
        /* Continuous background confetti rotation */
        @keyframes spin-slow {
            100% { transform: rotate(360deg); }
        }
        /* Main bot floating */
        @keyframes float-bot {
            0%, 100% { transform: translateY(0px); }
            50%      { transform: translateY(-10px); }
        }
        /* Target hovering diagonally */
        @keyframes float-target {
            0%, 100% { transform: translate(0px, 0px) rotate(-5deg); }
            50%      { transform: translate(-8px, -12px) rotate(5deg); }
        }
        /* Animated glowing chart line */
        @keyframes draw-chart {
            0%   { stroke-dashoffset: 250; }
            50%  { stroke-dashoffset: 0; }
            100% { stroke-dashoffset: -250; }
        }
        /* A/B Bouncing (Out of sync) */
        @keyframes bounce-squish {
            0%, 40%, 100% { transform: translateY(0px) scaleY(1) scaleX(1); }
            10%           { transform: translateY(5px) scaleY(0.9) scaleX(1.1); } /* Squish down */
            20%           { transform: translateY(-25px) scaleY(1.05) scaleX(0.95); } /* Jump up */
            30%           { transform: translateY(0px) scaleY(0.95) scaleX(1.05); } /* Land squish */
        }

        /* Apply Animations */
        .anim-bot       { animation: float-bot 4s ease-in-out infinite; }
        .anim-target    { animation: float-target 3.5s ease-in-out infinite; }
        .anim-var-a     { animation: bounce-squish 3.5s infinite; transform-origin: bottom center; }
        .anim-var-b     { animation: bounce-squish 3.5s infinite 1.75s; transform-origin: bottom center; }
        .anim-confetti  { animation: spin-slow 20s linear infinite; transform-origin: center; }
        
        .chart-trendline {
            stroke-dasharray: 250;
            animation: draw-chart 3s linear infinite;
        }
      `}} />

      <svg ref={svgRef} viewBox="0 0 500 500" className="w-full h-full drop-shadow-[0_15px_25px_rgba(0,0,0,0.1)] overflow-visible" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad-purple" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#9D4EDD" />
                <stop offset="100%" stopColor="#5A189A" />
            </linearGradient>
            
            <linearGradient id="grad-pink" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FF006E" />
                <stop offset="100%" stopColor="#FF5900" />
            </linearGradient>

            <linearGradient id="grad-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00F5D4" />
                <stop offset="100%" stopColor="#00BBF9" />
            </linearGradient>

            <linearGradient id="grad-gold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFBE0B" />
                <stop offset="100%" stopColor="#FB5607" />
            </linearGradient>

            <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        <g className="anim-confetti" opacity="0.4">
            <path d="M 80 100 L 95 115 M 95 100 L 80 115" stroke="#FF006E" strokeWidth="4" strokeLinecap="round"/>
            <circle cx="420" cy="150" r="6" fill="#00BBF9"/>
            <rect x="380" y="380" width="12" height="12" fill="#FFBE0B" transform="rotate(45 386 386)"/>
            <path d="M 120 400 Q 130 390 140 400 T 160 400" stroke="#9D4EDD" strokeWidth="4" fill="none" strokeLinecap="round"/>
            <circle cx="100" cy="250" r="4" fill="#FFBE0B"/>
            <circle cx="400" cy="280" r="8" fill="#FF006E"/>
        </g>

        <g className="anim-bot" transform="translate(150, 140)">
            <rect x="0" y="0" width="200" height="220" rx="50" fill="url(#grad-purple)" />
            
            <rect x="25" y="110" width="150" height="80" rx="20" fill="#FFFFFF" opacity="0.15" />
            
            <path d="M 40 160 L 70 140 L 100 170 L 130 130 L 160 150" 
                  stroke="#00F5D4" strokeWidth="5" fill="none" 
                  strokeLinecap="round" strokeLinejoin="round" 
                  filter="url(#neon-glow)" className="chart-trendline" />
            
            <g className="face-group" data-parallax="25">
                <ellipse cx="60" cy="70" rx="12" ry="6" className="color-blush"/>
                <ellipse cx="140" cy="70" rx="12" ry="6" className="color-blush"/>
                
                <g className="eye-group" transform="translate(75, 50)">
                    <circle cx="0" cy="0" r="16" className="color-white"/>
                    <circle className="pupil color-dark" cx="0" cy="0" r="7"/>
                </g>
                <g className="eye-group" transform="translate(125, 50)">
                    <circle cx="0" cy="0" r="16" className="color-white"/>
                    <circle className="pupil color-dark" cx="0" cy="0" r="7"/>
                </g>
                <path d="M 90 65 Q 100 80 110 65" className="color-dark" strokeWidth="4" strokeLinecap="round" fill="none"/>
            </g>
        </g>

        <g transform="translate(60, 270)">
            <g className="anim-var-a">
                <rect x="0" y="0" width="80" height="110" rx="40" fill="url(#grad-pink)" />
                <text x="40" y="90" className="ab-label" textAnchor="middle">A</text>
                
                <g className="face-group" data-parallax="15">
                    <ellipse cx="25" cy="55" rx="6" ry="3" className="color-blush"/>
                    <ellipse cx="55" cy="55" rx="6" ry="3" className="color-blush"/>
                    
                    <g className="eye-group" transform="translate(30, 40)">
                        <circle cx="0" cy="0" r="10" className="color-white"/>
                        <circle className="pupil color-dark" cx="0" cy="0" r="4"/>
                    </g>
                    <g className="eye-group" transform="translate(50, 40)">
                        <circle cx="0" cy="0" r="10" className="color-white"/>
                        <circle className="pupil color-dark" cx="0" cy="0" r="4"/>
                    </g>
                    <path d="M 35 52 Q 40 62 45 52 Z" className="color-dark" strokeLinejoin="round"/>
                </g>
            </g>
        </g>

        <g transform="translate(360, 270)">
            <g className="anim-var-b">
                <rect x="0" y="0" width="80" height="110" rx="40" fill="url(#grad-cyan)" />
                <text x="40" y="90" className="ab-label" textAnchor="middle">B</text>
                
                <g className="face-group" data-parallax="15">
                    <ellipse cx="25" cy="55" rx="6" ry="3" className="color-blush"/>
                    <ellipse cx="55" cy="55" rx="6" ry="3" className="color-blush"/>
                    
                    <g className="eye-group" transform="translate(30, 40)">
                        <circle cx="0" cy="0" r="10" className="color-white"/>
                        <circle className="pupil color-dark" cx="0" cy="0" r="4"/>
                    </g>
                    <g className="eye-group" transform="translate(50, 40)">
                        <circle cx="0" cy="0" r="10" className="color-white"/>
                        <circle className="pupil color-dark" cx="0" cy="0" r="4"/>
                    </g>
                    <circle cx="40" cy="55" r="3" className="color-dark"/>
                </g>
            </g>
        </g>

        <g className="anim-target" transform="translate(360, 60)">
            <path d="M 10 35 Q -15 20 0 0 Q 20 15 20 35 Z" fill="#FFFFFF" opacity="0.8"/>
            <path d="M 70 35 Q 95 20 80 0 Q 60 15 60 35 Z" fill="#FFFFFF" opacity="0.8"/>

            <circle cx="40" cy="40" r="35" fill="url(#grad-gold)" />
            <circle cx="40" cy="40" r="22" fill="#FFFFFF" opacity="0.9" />
            <circle cx="40" cy="40" r="10" fill="#FF5900" />
            
            <g className="face-group" data-parallax="10">
                <g className="eye-group" transform="translate(32, 35)">
                    <circle cx="0" cy="0" r="5" className="color-white"/>
                    <circle className="pupil color-dark" cx="0" cy="0" r="2"/>
                </g>
                <g className="eye-group" transform="translate(48, 35)">
                    <circle cx="0" cy="0" r="5" className="color-white"/>
                    <circle className="pupil color-dark" cx="0" cy="0" r="2"/>
                </g>
                <path d="M 37 42 Q 40 46 43 42" className="color-dark" strokeWidth="2" strokeLinecap="round" fill="none"/>
            </g>
        </g>
      </svg>
    </div>
  );
}
