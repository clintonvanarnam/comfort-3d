import {defineType} from 'sanity'

export default defineType({
  name: 'twoImageSpread',
  title: 'Two image spread',
  type: 'object',
  fields: [
    {
      name: 'leftImage',
      title: 'Left image',
      type: 'image',
      options: { hotspot: true },
      fields: [
        { name: 'alt', title: 'Alt text', type: 'string' },
        { name: 'caption', title: 'Caption', type: 'blockContent' },
        { name: 'credit', title: 'Credit', type: 'string' },
      ],
    },
    {
      name: 'rightImage',
      title: 'Right image',
      type: 'image',
      options: { hotspot: true },
      fields: [
        { name: 'alt', title: 'Alt text', type: 'string' },
        { name: 'caption', title: 'Caption', type: 'blockContent' },
        { name: 'credit', title: 'Credit', type: 'string' },
      ],
    },
    {
      name: 'stackOnMobile',
      title: 'Stack on mobile',
      type: 'boolean',
      description: 'When true the two images will stack vertically on small screens. Default true.',
      initialValue: true,
    },
    {
      name: 'leftSpan',
      title: 'Left image column span (1-12)',
      type: 'number',
      description: 'How many of 12 columns the left image occupies on wide screens. Default 6.',
      initialValue: 6,
      validation: (Rule) => Rule.min(1).max(12).integer(),
    },
    {
      name: 'leftOffset',
      title: 'Left image column offset (0-11)',
      type: 'number',
      description: 'How many columns to offset the left image from the left edge (0 = no offset).',
      initialValue: 0,
      validation: (Rule) => Rule.min(0).max(11).integer(),
    },
    {
      name: 'rightSpan',
      title: 'Right image column span (1-12)',
      type: 'number',
      description: 'How many of 12 columns the right image occupies on wide screens. Default 6.',
      initialValue: 6,
      validation: (Rule) => Rule.min(1).max(12).integer(),
    },
    {
      name: 'rightOffset',
      title: 'Right image column offset (0-11)',
      type: 'number',
      description: 'How many columns to offset the right image from the left edge (0 = no offset).',
      initialValue: 6,
      validation: (Rule) => Rule.min(0).max(11).integer(),
    },
  ],
  preview: {
    select: {
      left: 'leftImage.asset',
      right: 'rightImage.asset',
    },
    prepare(selection) {
      const {left, right} = selection
      return {
        title: 'Two image spread',
        subtitle: left && right ? 'Left & right images' : 'Incomplete spread',
      }
    },
  },
})
