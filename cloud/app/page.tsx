'use client';
import {useEffect} from 'react';
export default function Page(){useEffect(()=>{const script=document.createElement('script');script.src='/plantmeet.js';script.type='module';document.body.appendChild(script);return()=>script.remove()},[]);return <><div id="app"><p style={{padding:40}}>Загружаем PlantMeet...</p></div><div id="toast" role="status" aria-live="polite"/><dialog id="modal"/></>}
