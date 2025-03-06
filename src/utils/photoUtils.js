// 获取 public/images/photos 目录下的所有图片
function getImageUrls() {
  // 手动获取图片列表
  const imageUrls = [];
  // 假设public/images/photos目录下有这些图片
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
  
  // 遍历1到20，生成图片路径
  for (let i = 1; i <= 20; i++) {
    imageUrls.push({
      id: i,
      src: `/images/photos/${i}.jpg`,
      title: `照片 ${i}`
    });
  }
  
  return imageUrls;
}

export function getPhotos() {
  return getImageUrls();
}

export function getRandomPhotos(count = 5) {
  const allPhotos = getPhotos();
  return allPhotos
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(count, allPhotos.length));
}