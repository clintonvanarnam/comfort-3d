import {defineType} from 'sanity'

export default defineType({
  name: 'multiImageSpread',
  title: 'Multi image spread',
  type: 'object',
  fields: [
    {
      name: 'images',
      title: 'Images',
      type: 'array',
      of: [
        {
          type: 'image',
          options: { hotspot: true },
          fields: [
            { name: 'alt', title: 'Alt text', type: 'string' },
            { name: 'caption', title: 'Caption', type: 'blockContent' },
            { name: 'credit', title: 'Credit', type: 'string' },
          ],
        },
      ],
      validation: (Rule) => Rule.required().min(1),
    },
    {
      name: 'stackOnMobile',
      title: 'Stack on mobile',
      type: 'boolean',
      initialValue: true,
      description: 'When true the spread will stack vertically on small screens.',
    },
    {
      name: 'layout',
      title: 'Layout',
      type: 'string',
      initialValue: 'auto',
      options: {
        list: [
          { title: 'Auto', value: 'auto' },
          { title: 'Masonry', value: 'masonry' },
          { title: 'Grid', value: 'grid' },
        ],
      },
      description: 'Choose how images are arranged: auto (smart pick), masonry (columns) or a regular grid.',
    },
    {
      name: 'columnsDesktop',
      title: 'Desktop columns',
      type: 'number',
      initialValue: 3,
      description: 'Number of masonry columns to use on desktop (2-6).',
      validation: (Rule) => Rule.min(1).max(6).integer(),
    },
    {
      name: 'gutter',
      title: 'Gutter (px)',
      type: 'number',
      initialValue: 16,
      description: 'Space between images in pixels.',
    },
    {
      name: 'paddingTopToken',
      title: 'Desktop top padding token',
      type: 'string',
      initialValue: 'space-md',
      options: {
        list: [
          { title: 'None', value: 'space-0' },
          { title: 'XS', value: 'space-xs' },
          { title: 'SM', value: 'space-sm' },
          { title: 'MD', value: 'space-md' },
          { title: 'LG', value: 'space-lg' },
          { title: 'XL', value: 'space-xl' },
        ],
      },
    },
    {
      name: 'paddingBottomToken',
      title: 'Desktop bottom padding token',
      type: 'string',
      initialValue: 'space-md',
      options: {
        list: [
          { title: 'None', value: 'space-0' },
          { title: 'XS', value: 'space-xs' },
          { title: 'SM', value: 'space-sm' },
          { title: 'MD', value: 'space-md' },
          { title: 'LG', value: 'space-lg' },
          { title: 'XL', value: 'space-xl' },
        ],
      },
    },
  ],
  preview: {
    select: { first: 'images.0.asset', count: 'images' },
    prepare(selection) {
      const { first, count } = selection
      return {
        title: 'Multi image spread',
        subtitle: `${count || 0} images${first ? '' : ' (no assets)'}`,
      }
    },
  },
})
