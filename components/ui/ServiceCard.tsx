"use client";

import React, { useRef, useState } from "react";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { LucideIcon, ArrowUpRight } from "lucide-react";

interface ServiceCardProps {
  title: string;
  marathiTitle: string;
  description: string;
  badge: string;
  icon: LucideIcon;
  accentColor: string;
  index: number;
  onClick?: () => void;
}

export function ServiceCard({
  title,
  marathiTitle,
  description,
  badge,
  icon: Icon,
  accentColor,
  index,
  onClick,
}: ServiceCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    mouseX.set(x);
    mouseY.set(y);

    setRotateX(((y - centerY) / centerY) * -12);
    setRotateY(((x - centerX) / centerX) * 12);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 70, scale: 0.85 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: false, amount: 0.25 }}
      transition={{
        type: "spring",
        stiffness: 140,
        damping: 14,
        mass: 0.8,
        delay: index * 0.1,
      }}
      className="perspective-1000"
    >
      <motion.div
        ref={cardRef}
        onClick={onClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        whileHover={{ scale: 1.03, y: -6 }}
        style={{
          transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
          transition: "transform 0.18s ease-out, scale 0.25s ease-out, box-shadow 0.25s ease-out",
        }}
        className="group relative flex flex-col justify-between p-7 rounded-3xl bg-white/70 hover:bg-white/95 border border-white/80 hover:border-slate-300 shadow-md hover:shadow-[0_20px_50px_rgba(0,0,0,0.12)] backdrop-blur-2xl transition-all duration-300 cursor-pointer overflow-hidden min-h-[270px]"
      >
        {/* Cursor-Following Radial Glow Sheen */}
        <motion.div
          className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: useMotionTemplate`
              radial-gradient(
                350px circle at ${mouseX}px ${mouseY}px,
                ${accentColor}25,
                transparent 80%
              )
            `,
          }}
        />

        {/* Ambient Corner Blur */}
        <div
          className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-300"
          style={{ backgroundColor: accentColor }}
        />

        {/* Card Header */}
        <div className="relative z-10 flex items-start justify-between">
          <div
            className="w-13 h-13 rounded-2xl flex items-center justify-center text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
            style={{ backgroundColor: accentColor }}
          >
            <Icon className="w-6 h-6" />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-900/5 text-slate-700 border border-slate-200/80">
              {badge}
            </span>
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 group-hover:bg-slate-900 group-hover:text-white text-slate-700 transition-colors shadow-xs">
              <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="relative z-10 mt-6">
          <p className="text-[11px] font-extrabold tracking-wider uppercase text-amber-600 mb-1">
            {marathiTitle}
          </p>
          <h3 className="text-xl font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
            {title}
          </h3>
          <p className="text-xs font-medium text-slate-600 mt-2 leading-relaxed">
            {description}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}