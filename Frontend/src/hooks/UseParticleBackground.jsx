import { useEffect } from 'react';

// This hook encapsulates the entire canvas animation logic.
export default function useParticleBackground(canvasRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let particlesArray;

    const mouse = {
      x: null,
      y: null,
      radius: (canvas.height / 110) * (canvas.width / 110)
    };

    const handleMouseMove = (event) => {
      mouse.x = event.x;
      mouse.y = event.y;
    };
    window.addEventListener('mousemove', handleMouseMove);

    class Particle {
      constructor(x, y, directionX, directionY, size, color, isSpecial = false) {
        this.x = x;
        this.y = y;
        this.directionX = directionX;
        this.directionY = directionY;
        this.size = size;
        this.color = color;
        this.isSpecial = isSpecial;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        
        if (this.isSpecial) {
           ctx.shadowColor = 'rgba(200, 120, 255, 0.8)';
           ctx.shadowBlur = 15;
        }
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }
      update() {
        if (this.x > canvas.width || this.x < 0) this.directionX = -this.directionX;
        if (this.y > canvas.height || this.y < 0) this.directionY = -this.directionY;
        this.x += this.directionX;
        this.y += this.directionY;
        this.draw();
      }
    }

    function init() {
      particlesArray = [];
      let numberOfParticles = (canvas.height * canvas.width) / 10000;
      for (let i = 0; i < numberOfParticles; i++) {
        const isSpecial = i % 20 === 0;
        const size = isSpecial ? (Math.random() * 4) + 2 : (Math.random() * 2) + 1;
        const color = isSpecial ? 'rgba(255, 255, 255, 0.9)' : 'rgba(200, 120, 255, 0.6)';
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const directionX = (Math.random() * 0.4) - 0.2;
        const directionY = (Math.random() * 0.4) - 0.2;
        particlesArray.push(new Particle(x, y, directionX, directionY, size, color, isSpecial));
      }
    }

    function connect() {
      let opacityValue = 1;
      for (let a = 0; a < particlesArray.length; a++) {
        let distanceToMouse = ((particlesArray[a].x - mouse.x) ** 2) + ((particlesArray[a].y - mouse.y) ** 2);
        if (distanceToMouse < mouse.radius) {
            opacityValue = 1 - (distanceToMouse / mouse.radius);
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacityValue * 0.5})`;
            ctx.lineWidth = 1;
            ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(particlesArray[a].x, particlesArray[a].y);
            ctx.stroke();
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        }
        for (let b = a; b < particlesArray.length; b++) {
          let distance = ((particlesArray[a].x - particlesArray[b].x) ** 2) + ((particlesArray[a].y - particlesArray[b].y) ** 2);
          if (distance < (canvas.width / 8) * (canvas.height / 8)) {
            opacityValue = 1 - (distance / 20000);
            ctx.strokeStyle = `rgba(200, 120, 255, ${opacityValue * 0.3})`;
            ctx.lineWidth = 1;
            ctx.shadowColor = 'rgba(200, 120, 255, 0.6)';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
            ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
            ctx.stroke();
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
          }
        }
      }
    }

    let animationFrameId;
    function animate() {
      animationFrameId = requestAnimationFrame(animate);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
      }
      connect();
    }

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      mouse.radius = (canvas.height / 110) * (canvas.width / 110);
      init();
    };
    window.addEventListener('resize', handleResize);
    
    init();
    animate();
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    }
  }, [canvasRef]);
}