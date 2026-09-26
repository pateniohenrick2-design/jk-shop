import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

export default async function GamePage({ params }: { params: { slug: string } }) {
  const game = await prisma.game.findUnique({
    where: { slug: params.slug },
    include: {
      categories: {
        include: { items: true, fields: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!game) return notFound();

  const mainCategories = game.categories.filter((c) => c.group === 'main');
  const otherCategories = game.categories.filter((c) => c.group === 'others');

  return (
    <main style={{ padding: 40 }}>
      <h1>{game.name}</h1>
      <h3>Main Category</h3>
      <ul>{mainCategories.map((c) => <li key={c.id}>{c.name}</li>)}</ul>
      <h3>Others</h3>
      <ul>{otherCategories.map((c) => <li key={c.id}>{c.name}</li>)}</ul>
      {/* TODO: wire up the actual 7-step order form UI from the mockup here,
          using category.fields for Account Details and category.items for the pricelist */}
    </main>
  );
}
