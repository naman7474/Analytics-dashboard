"use client";

import React, { useEffect, useRef } from "react";

export function SignInIllustration() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!svgRef.current) return;
      
      const svg = svgRef.current;
      const rect = svg.getBoundingClientRect();
      
      // Calculate mouse position relative to the center of the SVG
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Normalize to a range of -1 to 1 based on screen size to make the movement smooth
      // and not overly sensitive
      const percentX = (e.clientX - centerX) / (window.innerWidth / 2);
      const percentY = (e.clientY - centerY) / (window.innerHeight / 2);

      // Max pixels the eyes/mouth can move
      const maxMove = 5;

      const moveX = percentX * maxMove;
      const moveY = percentY * maxMove;

      // Apply transform using a custom property or directly to elements with class 'track-mouse'
      const trackingElements = svg.querySelectorAll('.track-mouse') as NodeListOf<HTMLElement | SVGElement>;
      trackingElements.forEach((el) => {
        el.style.transform = `translate(${moveX}px, ${moveY}px)`;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="relative w-full aspect-square max-w-[500px] flex items-center justify-center">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes float-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-25px); }
        }
        @keyframes float-fast {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-35px); }
        }
        @keyframes float-horizontal {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(10px); }
        }
        
        .animate-float-slow { animation: float-slow 6s ease-in-out infinite; }
        .animate-float-medium { animation: float-medium 5s ease-in-out infinite; }
        .animate-float-fast { animation: float-fast 4s ease-in-out infinite; }
        .animate-float-horizontal { animation: float-horizontal 7s ease-in-out infinite; }
        
        .track-mouse {
          transition: transform 0.1s ease-out;
        }
      `}} />

      <svg ref={svgRef} viewBox="0 0 400 400" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        
        {/* Large Light Pink Blob (Right side) */}
        <g className="animate-float-slow" style={{ animationDelay: '0s' }}>
          <path d="M190 180 C190 130 230 90 280 90 C330 90 370 130 370 180 L370 340 A10 10 0 0 1 360 350 L200 350 A10 10 0 0 1 190 340 Z" fill="#F4B5C8" />
          <circle cx="280" cy="180" r="30" fill="white" />
          <circle className="track-mouse" cx="290" cy="180" r="15" fill="#2E3033" />
        </g>
        
        {/* Tall Red/Pink Structure (Middle-Left) */}
        <g className="animate-float-medium" style={{ animationDelay: '1s' }}>
          <path d="M140 120 L130 340" stroke="#F1516A" strokeWidth="20" strokeLinecap="round" />
          <path d="M140 120 L180 340" stroke="#F1516A" strokeWidth="20" strokeLinecap="round" />
          <rect x="110" y="80" width="160" height="40" rx="20" fill="#F1516A" />
          <rect x="130" y="100" width="30" height="10" rx="5" fill="#BA1C36" />
        </g>

        {/* Sneaking Eyes behind the red bar */}
        <g className="animate-float-horizontal" style={{ animationDelay: '2s' }}>
          <circle cx="180" cy="70" r="16" fill="white" />
          <circle className="track-mouse" cx="183" cy="70" r="6" fill="#2E3033" />
          <circle cx="215" cy="75" r="14" fill="white" />
          <circle className="track-mouse" cx="218" cy="75" r="5" fill="#2E3033" />
        </g>

        {/* Small Blue Creature (Center Bottom) */}
        <g className="animate-float-fast" style={{ animationDelay: '0.5s' }}>
          <rect x="200" y="200" width="100" height="100" rx="50" fill="#4B8BF4" />
          <path d="M220 280 L220 320" stroke="#4B8BF4" strokeWidth="16" strokeLinecap="round" />
          <path d="M280 280 L280 320" stroke="#4B8BF4" strokeWidth="16" strokeLinecap="round" />
          <circle cx="230" cy="240" r="14" fill="white" />
          <circle className="track-mouse" cx="233" cy="240" r="5" fill="#2E3033" />
          <circle cx="265" cy="240" r="18" fill="white" />
          <circle className="track-mouse" cx="270" cy="240" r="7" fill="#2E3033" />
          <g className="track-mouse">
            <circle cx="250" cy="275" r="8" fill="#1B3A6C" />
            <circle cx="250" cy="275" r="3" fill="white" />
          </g>
        </g>

        {/* Light Teal Cloud Creature (Left) */}
        <g className="animate-float-medium" style={{ animationDelay: '1.5s' }}>
          <path d="M125 180 L100 320" stroke="#7BC6C9" strokeWidth="18" strokeLinecap="round" />
          <path d="M125 180 L145 320" stroke="#7BC6C9" strokeWidth="18" strokeLinecap="round" />
          
          <path d="M125 240 A 30 30 0 1 0 125 150 A 30 30 0 0 0 95 180 A 30 30 0 0 0 95 240 A 30 30 0 0 0 160 220 A 30 30 0 0 0 140 160 Z" fill="#7BC6C9" />
          
          <circle cx="110" cy="180" r="14" fill="white" />
          <circle className="track-mouse" cx="112" cy="180" r="5" fill="#2E3033" />
          <circle cx="140" cy="185" r="12" fill="white" />
          <circle className="track-mouse" cx="142" cy="185" r="4" fill="#2E3033" />
          <ellipse className="track-mouse" cx="125" cy="215" rx="5" ry="10" fill="#2C6B6D" />
        </g>

      </svg>
    </div>
  );
}
