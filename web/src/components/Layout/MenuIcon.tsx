import React from 'react';
import * as Icons from 'lucide-react';

interface MenuIconProps {
  name: string;
  size?: number;
}

export const MenuIcon: React.FC<MenuIconProps> = ({ name, size = 18 }) => {
  const IconComponent = (Icons as any)[name] || Icons.Circle;
  return <IconComponent size={size} />;
};
