"use client"

import React from "react"
import cn from "cnfast"
import "./arrow-fill-button.css"

export type ArrowFillButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    as?: React.ElementType
    bgColor?: string
    textColor?: string
    fillBgColor?: string
    fillTextColor?: string
    hoverFillBgColor?: string
    hoverFillTextColor?: string
    arrowColor?: string
    hoverArrowColor?: string
  }

export function TryOut({
  children = "Explore components",
  className = "",
  bgColor = "#ff6b00",
  textColor = "#ffffff",
  fillBgColor = "#ffffff",
  fillTextColor = "#ff6b00",
  hoverFillBgColor = "#ffffff",
  hoverFillTextColor = "#ff6b00",
  arrowColor,
  hoverArrowColor,
  as: Component = "a",
  style,
  ...props
}: ArrowFillButtonProps) {
  return (
    <Component
      type={Component === "button" ? "button" : undefined}
      {...props}
      className={cn("obsidian-arrow-fill-btn", className)}
      style={
        {
          "--btn-bg": bgColor,
          "--btn-text": textColor,
          "--btn-fill-bg": fillBgColor,
          "--btn-fill-text": fillTextColor,
          "--btn-fill-bg-hover": hoverFillBgColor,
          "--btn-fill-text-hover": hoverFillTextColor,
          "--btn-arrow": arrowColor || fillTextColor,
          "--btn-arrow-hover": hoverArrowColor || hoverFillTextColor,
          ...style,
        } as React.CSSProperties
      }
    >
      <span className="obsidian-arrow-fill-btn__text">{children}</span>

      <div aria-hidden="true" className="obsidian-arrow-fill-btn__circle">
        <span>{children}</span>

        <div className="obsidian-arrow-fill-btn__circle-text">
          <svg viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" className="obsidian-arrow-fill-btn__icon">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M3.82475e-07 5.625L7.625 5.625L4.125 9.125L5 10L10 5L5 -4.37114e-07L4.125 0.874999L7.625 4.375L4.91753e-07 4.375L3.82475e-07 5.625Z"
              className="obsidian-arrow-fill-btn__path"
            />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M3.82475e-07 5.625L7.625 5.625L4.125 9.125L5 10L10 5L5 -4.37114e-07L4.125 0.874999L7.625 4.375L4.91753e-07 4.375L3.82475e-07 5.625Z"
              className="obsidian-arrow-fill-btn__path"
            />
          </svg>
        </div>
      </div>
    </Component>
  )
}
