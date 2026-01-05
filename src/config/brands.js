const brands = {
  jpool: {
    name: 'Jpool',
    displayName: 'Jpool',
    notificationName: 'Jpool',
    logo: 'jpool.png',
    colors: {
      primary: '#f4b000',
      secondary: '#ffcb2a',
      background: '#0b1224',
      accent: '#f4b000',
      dark: '#0b1021'
    }
  }
};

function getBrand(brandId = 'jpool') {
  return brands[brandId] || brands.jpool;
}

function getBrandName(brandId = 'jpool') {
  const brand = getBrand(brandId);
  return brand.notificationName || brand.name;
}

module.exports = {
  brands,
  getBrand,
  getBrandName
};

