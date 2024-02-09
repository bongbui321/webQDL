'use client';

import {qdlDevice} from "@/utils/qdl";

const qdldevice = new qdlDevice();

function Header() {
  return <h1>Flash Qualcom device</h1>
};

export default function HomePage() {
  return (
  <div>
    <Header />
    <button onClick={qdldevice.connect}>Connect</button>
  </div>
  )
}