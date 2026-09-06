import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '../lib/firebase';

// Redimensiona no canvas do navegador antes de subir — mesma técnica de sempre, só que agora o
// resultado vai pro Storage (não mais base64 dentro do Firestore), então dá pra usar uma
// resolução bem mais alta sem risco de estourar o limite de 1MB por documento.
function resizeImageFile(file: File, maxSide: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler o arquivo.'));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Falha ao carregar a imagem.'));
      img.onload = () => {
        const ratio = Math.min(maxSide / img.width, maxSide / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem.'))),
          'image/jpeg',
          quality
        );
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Foto de produto/variação — sobe pro Firebase Storage em users/{uid}/productPhotos/ (ver
// storage.rules: leitura pública, escrita só do dono) e devolve a download URL, que entra no
// mesmo campo `photoUrl`/`photoAlbum` de sempre (string) — nenhum outro lugar do app precisa
// saber se é uma data URI antiga ou uma URL do Storage nova, os dois funcionam igual num <img>.
// quality 0.8 (não 0.9+) de propósito — com centenas de clientes abrindo o Catálogo Público,
// egress (download) é o que realmente pesa no custo do Storage, não o espaço ocupado; 0.8 já
// fica bem mais nítido que o 400px/600px antigo sem inflar o tamanho do arquivo à toa.
export async function uploadProductPhoto(file: File, maxSide: number, quality = 0.8): Promise<string> {
  if (!auth.currentUser) throw new Error('Não autenticado.');
  const blob = await resizeImageFile(file, maxSide, quality);
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
  const photoRef = ref(storage, `users/${auth.currentUser.uid}/productPhotos/${fileName}`);
  // Cache longo (1 ano, imutável) — o nome do arquivo já muda a cada upload (timestamp+random),
  // então nunca reaproveita um nome antigo; isso deixa o navegador do cliente do Catálogo
  // Público reaproveitar a mesma foto sem baixar de novo a cada visita, economizando egress.
  await uploadBytes(photoRef, blob, { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' });
  return getDownloadURL(photoRef);
}
