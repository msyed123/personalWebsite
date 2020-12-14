<template>
    <section>
        <div>
            <br />
            <b-card 
            header="Courses"
            class="mx-auto"
            style="width: 85%"
            >
                <!-- <b-card
                class="mx-auto overflow-hidden"
                > -->
                    <Courses />
                <!-- </b-card> -->
            </b-card>

            <br />
        </div>
    </section>
</template>

<script>
import Courses from '~/components/Courses.vue'
export default {
    components: {
        Courses
    }
}
</script>

<style>
    h1{
        padding-top: 20px;
        padding-left: 20px;
        text-align: left;
        font-family: monaco, monospace;
    }
    p {
        padding-top: 20px;
        padding-left: 20px;
        padding-right: 20px;
        text-align: left;
        font-family: monaco, monospace;
    }
</style>
