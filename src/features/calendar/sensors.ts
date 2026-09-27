"use client";

import { PointerSensor } from "@dnd-kit/core";

/**
 * PointerSensor die aanrakingen negeert: touch loopt via de TouchSensor
 * (met vasthoud-vertraging), zodat vegen gewoon scrolt in plaats van sleept.
 */
export class MousePointerSensor extends PointerSensor {
  static activators: typeof PointerSensor.activators = [
    {
      eventName: "onPointerDown",
      handler: ({ nativeEvent: event }, { onActivation }) => {
        if (event.pointerType === "touch" || !event.isPrimary || event.button !== 0) return false;
        onActivation?.({ event });
        return true;
      },
    },
  ];
}
