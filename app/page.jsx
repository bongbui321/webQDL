'use client';

import LikeButton from './like-button';
import {qdlDevice} from './qdl'

const qdldevice = new qdlDevice(); 

function Header() {
  return <h1>Flash Qualcom device</h1>
};

export default function HomePage() {
  return (
  <div>
    <Header />
    <button onClick={qdldevice.connect}>connect</button>
  </div>
  )
}