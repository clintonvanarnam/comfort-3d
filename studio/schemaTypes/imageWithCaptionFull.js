import {defineType} from 'sanity'

export default defineType({
  name: 'imageWithCaptionFull',
  title: 'Image with caption (full)',
  type: 'image',
  fields: [
    {
      name: 'alt',
      title: 'Alt text',
      type: 'string',
      options: {isHighlighted: true},
    },
    {
      name: 'caption',
      title: 'Caption',
      type: 'blockContent',
      options: {isHighlighted: true},
    },
    {
      name: 'credit',
      title: 'Credit',
      type: 'string',
      options: {isHighlighted: true},
    },
  ],
  options: {
    hotspot: true,
  },
})