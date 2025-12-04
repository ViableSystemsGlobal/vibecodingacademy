import prisma from '../config/database';

export class CmsService {
  async getBlock(slug: string) {
    const block = await prisma.cmsBlock.findUnique({
      where: { slug },
    });
    return block;
  }

  async getAllBlocks() {
    return prisma.cmsBlock.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  async upsertBlock(slug: string, content: any) {
    return prisma.cmsBlock.upsert({
      where: { slug },
      update: { content },
      create: { slug, content },
    });
  }
}

export const cmsService = new CmsService();

