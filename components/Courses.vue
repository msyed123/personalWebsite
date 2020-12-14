<template>
    <div>
        <div v-if="loading">
            <b-card
            no-body
            border-variant="primary"
            header-bg-variant="primary"
            header-text-variant="white" 
            class="overflow-hidden"
            header="Loading...">
                <Loading />
            </b-card>
        </div>
        <div v-else>
            <li v-for="course in courses" v-bind:key="course.data.course_name">
                <b-card 
                no-body
                border-variant="primary"
                header-bg-variant="primary"
                header-text-variant="white" 
                class="overflow-hidden"
                v-bind:header="course.data.course_name[0].text"
                >
                    <b-card-body>
                        <b-card-text>
                            <li v-for="topic in course.data.topics" v-bind:key="topic.topic[0].text">
                                {{topic.topic[0].text}}
                            </li>
                            <div v-if="course.data.documents.length > 0">
                                <hr />
                                <li v-for="document in course.data.documents" v-bind:key="document.document_name[0].text">
                                    <a class="btn btn-outline-primary" v-bind:href="document.document_link.url" role="button" target="_blank">
                                        {{document.document_name[0].text}}
                                    </a>
                                </li>
                            </div>
                        </b-card-text>
                    </b-card-body>
                </b-card>
            </li>
        </div>   
    </div>
</template>

<script>
import Loading from "~/components/Loading.vue";
import Prismic from "prismic-javascript";
import PrismicDom from "prismic-dom";

export default {
    components: {
        Loading
    },
    data() {
        return{
            loading: true,
            courses: [],
        };
    }, 

    methods: {
        async getProjects() {
            const api = await Prismic.getApi(process.env.PRISMIC_ENDPOINT, {accessToken: process.env.PRISMIC_TOKEN});
            const response = await api.query(
                Prismic.Predicates.at("document.type", "course"),
                { orderings : '[my.course.priority]'}
            )
            this.courses = response.results;
            this.loading = false;
        }
    },

    created() {
        this.getProjects()
    }
};
</script>

<style>
body{
	font-family: monaco, monospace;
}

*{
	padding: 0;
	margin: 0;
	box-sizing:border-box;
}

li{
	list-style-type: none;
    padding-bottom: 20px
}

.project{
	margin:5px;
	font-size: 16px;
}

.bar{
	width: 100%;
	background:#dfdfdf;
	overflow: hidden;
	padding:5px;
}

.progress{
	float:left;
	padding:15px;
}

.dates{
	float: right;
	font-weight: 600;
	height: 30px;
	line-height: 30px;
}
</style>
