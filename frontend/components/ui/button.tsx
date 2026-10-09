import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
const variants=cva("button",{variants:{variant:{default:"button-primary",outline:"button-outline"}},defaultVariants:{variant:"default"}});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>,VariantProps<typeof variants>{asChild?:boolean}
export const Button=React.forwardRef<HTMLButtonElement,ButtonProps>(({className,variant,asChild=false,...props},ref)=>{const Component=asChild?Slot:"button";return <Component className={twMerge(clsx(variants({variant}),className))} ref={ref} {...props}/>;});Button.displayName="Button";
