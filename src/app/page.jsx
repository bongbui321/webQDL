'use client';

import {qdlDevice} from "@/utils/qdl";
import { useRef } from 'react'

function Header() {
  return <h1>Flash Qualcom device</h1>
};

export default function HomePage() {
  const qdldevice = useRef(new qdlDevice());
  const handleConnectClick = () => {
    qdldevice.current.connect();
  };

  return (
  <div>
    <Header />
    <button onClick={handleConnectClick}>Connect</button>
  </div>
  )
}