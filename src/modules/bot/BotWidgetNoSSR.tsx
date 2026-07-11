"use client";
import dynamic from "next/dynamic";

const BotWidgetNoSSR = dynamic(() => import("./BotWidget"), { ssr: false });
export default BotWidgetNoSSR;
