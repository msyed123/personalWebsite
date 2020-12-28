<template>
  <vue-navigation-bar :options="navbarOptions" />
</template>

<script>
import "vue-navigation-bar/dist/vue-navigation-bar.css";
export default {
  data() {
    return {
      navbarOptions: {
        elementId: 'main-navbar',
        isUsingVueRouter: true,
        mobileBreakpoint: 992,
        ariaLabelMainNav: 'Main Navigation',
        tooltipAnimationType: 'shift-away',
        menuOptionsLeft: [
          {
            type: 'button',
            text: 'Home',
            path: './'
          },
          {
            type: 'button',
            text: 'About',
            path: {name: "about"}
            // subMenuOptions: [
            //   {
            //     type: 'link',
            //     subText: "Stuff I find interesting and think I'm OK-ish at",
            //     path: {name: "about"}
            //   },
            // ]
          },
          {
            type: 'button',
            text: 'Projects',
            path: {name: "projects"}
            // subMenuOptions: [
            //   {
            //     type: 'link',
            //     subText: "My bringers of insomnia",
            //     path: './projects'
            //   },
            // ]
          },
          {
            type: 'button',
            text: 'Courses',
            path: {name: "courses"}
            // subMenuOptions: [
            //   {
            //     type: 'link',
            //     subText: "The stuff that gives my diploma meaning",
            //     path: './courses'
            //   },
            // ]
          },
          {
            type: 'button',
            text: 'Contact',
            path: {name: "contact"}
            // subMenuOptions: [
            //   {
            //     type: 'link',
            //     subText: "I promise I am not currently known to bite",
            //     path: './contact'
            //   },
            // ]
          },
        ],
      }
    }
  },
};
</script>

<style>
</style>
