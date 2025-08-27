// /schemas/about.ts
import {defineType} from 'sanity'

export default defineType({
  name: 'about',
  title: 'About',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      initialValue: 'About',
      validation: (Rule) => Rule.required(),
      readOnly: true,            // keep it fixed
    },
    {
      name: 'body',
      title: 'Body',
      type: 'blockContent',
    },
  ],
  preview: {
    select: {
      title: 'title',
      // grab the first block’s first span for a quick subtitle
      body0: 'body.0.children.0.text',
    },
    prepare({title, body0}) {
      return {
        title: title || 'About',
        subtitle: body0 ? body0.slice(0, 80) : 'About page content',
      }
    },
  },
})