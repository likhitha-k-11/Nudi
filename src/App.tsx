/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from "react";
import { initNudiRouter } from "./nudiClient.ts";

export default function App() {
  useEffect(() => {
    return initNudiRouter();
  }, []);

  return (
    <>
      <header>
        <a className="logo" href="#home">
          ನುಡಿ <small>NUDI</small>
        </a>
        <nav>
          <a href="#home" data-r="home">
            Home
          </a>
          <a href="#studio" data-r="studio">
            Studio
          </a>
          <a href="#explore" data-r="explore">
            Explore
          </a>
          <a href="#progress" data-r="progress">
            Progress
          </a>
        </nav>
      </header>
      <main id="app" />
    </>
  );
}
