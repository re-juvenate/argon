import { useEffect, useRef } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";

export function useTour() {
  const driverRef = useRef<Driver | null>(null);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem("argon_tour_seen");
    
    // Prevent strict mode double initialization
    if (driverRef.current) return;
    
    if (!hasSeenTour) {
      const tour = driver({
        showProgress: true,
        steps: [
          { 
            element: '#tour-sidepanel', 
            popover: { 
              title: 'Add Elements', 
              description: 'This is the side panel where you can find all available AWS services and nodes.' 
            } 
          },
          { 
            element: '#tour-canvas-wrapper',
            popover: { 
              title: 'Pro Tip: Shift + A', 
              description: 'You can also press Shift + A anywhere on the canvas to quickly open a menu and add a new element!' 
            } 
          },
          { 
            element: '#tour-canvas-wrapper', 
            popover: { 
              title: 'Drag & Drop', 
              description: 'Drag a node from the side panel and drop it here on the canvas to build your architecture.' 
            } 
          },
          { 
            element: '#tour-simulate', 
            popover: { 
              title: 'Simulation', 
              description: 'Click here to run a simulation of your current graph architecture.' 
            } 
          },
          { 
            element: '#tour-both', 
            popover: { 
              title: 'Detailed Graphs', 
              description: 'You can drag a node from the canvas into the bottom area to view detailed metric graphs.' 
            } 
          },
          { 
            element: '[data-node]', 
            popover: { 
              title: 'Configure Parameters', 
              description: 'Double click on any node name to rename it, or right click it to open the context menu and configure its parameters.' 
            } 
          },
          { 
            element: '#tour-color', 
            popover: { 
              title: 'Deploy to AWS', 
              description: 'Once everything is ready, deploy your architecture or export your graph here.' 
            } 
          },
        ],
        onDestroyStarted: () => {
          if (!tour.hasNextStep() || confirm("Are you sure you want to skip the tour?")) {
            tour.destroy();
            localStorage.setItem("argon_tour_seen", "true");
          }
        },
      });

      driverRef.current = tour;

      // Give components a tiny bit of time to mount their refs/ids
      setTimeout(() => {
        tour.drive();
      }, 500);
    }
  }, []);
}
