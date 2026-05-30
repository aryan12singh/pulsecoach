"use client";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  pad?: boolean;
  hover?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export default function Card({ children, pad = true, hover = false, className = "", style, onClick }: CardProps) {
  return (
    <div
      className={`bg-surface border border-border rounded-lg shadow-card ${
        pad ? "p-s-5" : ""
      } ${
        hover ? "transition-all duration-[180ms] ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-card-lg" : ""
      } ${className}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
