import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { X, Zap, ZapOff } from 'lucide-react';

interface WebCameraScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

export default function WebCameraScanner({ onScan, onClose }: WebCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<any>(null);
  const foundRef = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    foundRef.current = false;
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Câmera não suportada neste navegador.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current!.play();
          setReady(true);
          // Use BarcodeDetector if available (Chrome Android 83+), otherwise jsQR
          if (window.BarcodeDetector) {
            try {
              detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
            } catch {
              detectorRef.current = null;
            }
          }
          rafRef.current = requestAnimationFrame(scanFrame);
        };
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setError('Permissão de câmera negada. Toque no ícone de câmera na barra de endereço do navegador e permita o acesso.');
      } else if (msg.includes('NotFound')) {
        setError('Câmera não encontrada neste dispositivo.');
      } else {
        setError('Não foi possível acessar a câmera: ' + msg);
      }
    }
  };

  const stopCamera = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const scanFrame = async () => {
    if (foundRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    let result: string | null = null;

    // Try BarcodeDetector first (faster on Android)
    if (detectorRef.current) {
      try {
        const codes = await detectorRef.current.detect(video);
        if (codes.length > 0) result = codes[0].rawValue;
      } catch { /* fallthrough to jsQR */ }
    }

    // Fallback: jsQR on canvas
    if (!result) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });
      if (code) result = code.data;
    }

    if (result) {
      foundRef.current = true;
      stopCamera();
      onScan(result);
      return;
    }

    rafRef.current = requestAnimationFrame(scanFrame);
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn(t => !t);
    } catch { /* torch not supported */ }
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[60vh]">
      {/* Video feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Hidden canvas for jsQR */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Scanning overlay */}
      {ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-56 h-56">
            {/* Corner brackets */}
            <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-violet-400 rounded-tl-lg" />
            <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-violet-400 rounded-tr-lg" />
            <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-violet-400 rounded-bl-lg" />
            <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-violet-400 rounded-br-lg" />
            {/* Scanning line animation */}
            <span className="absolute inset-x-0 h-0.5 bg-violet-400 opacity-80 animate-scan-line" />
          </div>
          <p className="absolute bottom-6 text-white/80 text-xs font-bold uppercase tracking-widest">
            Aponte para o QR Code
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-black/80 text-center">
          <p className="text-red-400 text-sm font-bold mb-4">{error}</p>
          <button
            type="button"
            onClick={startCamera}
            className="px-6 py-3 rounded-2xl bg-violet-600 text-white text-xs font-black uppercase tracking-widest active:scale-95 transition-all"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Loading state */}
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <p className="text-white/70 text-xs font-bold uppercase tracking-widest animate-pulse">
            Iniciando câmera...
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-3 right-3 flex gap-2">
        <button
          type="button"
          onClick={toggleTorch}
          className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white active:scale-90 transition-all"
          title="Lanterna"
        >
          {torchOn ? <ZapOff size={18} /> : <Zap size={18} />}
        </button>
        <button
          type="button"
          onClick={() => { stopCamera(); onClose(); }}
          className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white active:scale-90 transition-all"
          title="Fechar câmera"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
