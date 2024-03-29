import { Account, Client, Databases, Functions, ID, Query, Storage, type Models } from 'appwrite';
import moment from 'moment';

const client = new Client()
	.setEndpoint('https://appwrite.techscrunch.dev/v1')
	.setProject('techCrunchs');
const databases = new Databases(client);
const storage = new Storage(client);
const account = new Account(client);
const functions = new Functions(client);

export type Category = {
	name: string;
	description: string;
	hidden: boolean;
} & Models.Document;

export type Tag = {
	name: string;
} & Models.Document;

export type ArticleTag = {
	articleId: string;
	tagId: string;
} & Models.Document;

export type Author = {
	name: string;
	imageId?: string;
	bio?: string;
	twitter?: string;
	email?: string;
} & Models.Document;

export type Article = {
	content: string;
	imageId: string;
	isPromoted: boolean;
	categoryId: string;
	title: string;
	authorId: string;
	isPinned: boolean;
	isPublished: boolean;
	shortId: string;
	isPlus: boolean;

	// Front-end only
	category?: Category;
	author?: Author;
	verboseDate: string;

	// Front-end only, only in article detail (getArticle)
	tags?: Tag[];
} & Models.Document;

export const PageSize = {
	Articles: 25
};

function getVerboseDate(dateStr: string) {
	return moment(dateStr).format('h:mm A G\\MTZ • MMMM D, YYYY');
}

export const AppwriteService = {
	createProfile: async () => {
		const user = await AppwriteService.getAccount();
		return await databases.createDocument<Author>('default', 'authors', ID.unique(), {
			name: user?.name ?? 'Anonymous'
		});
	},
	updateProfile: async (profileId: string, changes: Partial<Author>) => {
		return await databases.updateDocument<Author>('default', 'authors', profileId, changes);
	},
	generateArticle: async (title: string, category: string) => {
		const res = await functions.createExecution(
			'generateArticle',
			JSON.stringify({ title, categoryId: category })
		);

		if (res.status === 'failed') {
			throw new Error('Internal Error. Try again later.');
		}
		if (res.response) {
			const json = JSON.parse(res.response);
			if (json.success === false) {
				throw new Error(json.msg);
			}
		}

		return res;
	},
	updatePrefs: async (prefs: any) => {
		return await account.updatePrefs(prefs);
	},
	uploadProfilePicture: async (file: any) => {
		return await storage.createFile('profilePictures', ID.unique(), file);
	},
	changePassword: async (oldPassword: string, newPassword: string) => {
		return await account.updatePassword(newPassword, oldPassword);
	},
	resetPassword: async (email: string) => {
		return await account.createRecovery(email, `${window.location.origin}/auth/password-reset`);
	},
	resetPasswordFinish: async (
		userId: string,
		secret: string,
		password: string,
		passwordAgain: string
	) => {
		return await account.updateRecovery(userId, secret, password, passwordAgain);
	},
	oauthLogin: () => {
		account.createOAuth2Session(
			'github',
			`${window.location.origin}/`,
			`${window.location.origin}/auth/login`
		);
	},
	login: async (email: string, password: string) => {
		return await account.createEmailSession(email, password);
	},
	register: async (name: string, email: string, password: string) => {
		return await account.create(ID.unique(), email, password, name);
	},
	logout: async () => {
		return await account.deleteSession('current');
	},
	getAccount: async () => {
		try {
			return await account.get();
		} catch (err) {
			console.log(err);
			return null;
		}
	},
	getProfile: async (profileId: string) => {
		try {
			return await databases.getDocument<Author>('default', 'authors', profileId);
		} catch (err) {
			console.log(err);
			return null;
		}
	},
	listCategories: async () => {
		return await databases.listDocuments<Category>('default', 'categories', [
			Query.limit(10),
			Query.equal('hidden', false),
			Query.orderAsc('$createdAt')
		]);
	},
	getCategories: async (categoryIds: string[]) => {
		return await databases.listDocuments<Category>('default', 'categories', [
			Query.equal('$id', categoryIds),
			Query.orderAsc('$createdAt')
		]);
	},
	getAuthors: async (authorIds: string[]) => {
		return await databases.listDocuments<Author>('default', 'authors', [
			Query.equal('$id', authorIds),
			Query.orderAsc('$createdAt')
		]);
	},
	getCategory: async (categoryId: string) => {
		return await databases.getDocument<Category>('default', 'categories', categoryId);
	},
	getTag: async (tagId: string) => {
		return await databases.getDocument<Tag>('default', 'tags', tagId);
	},
	getAuthor: async (authorId: string) => {
		return await databases.getDocument<Author>('default', 'authors', authorId);
	},
	getArticleTagsbyArticle: async (articleId: string) => {
		return await databases.listDocuments<ArticleTag>('default', 'articleTags', [
			Query.equal('articleId', articleId)
		]);
	},
	getArticleTagsByTag: async (tagId: string) => {
		return await databases.listDocuments<ArticleTag>('default', 'articleTags', [
			Query.equal('tagId', tagId)
		]);
	},
	getTags: async (tagIds: string[]) => {
		return await databases.listDocuments<Tag>('default', 'tags', [Query.equal('$id', tagIds)]);
	},
	getArticle: async (articleId: string) => {
		const article = await databases.getDocument<Article>('default', 'articles', articleId);

		article.verboseDate = getVerboseDate(article.$createdAt);

		const [category, author, tags] = await Promise.all([
			AppwriteService.getCategory(article.categoryId),
			AppwriteService.getAuthor(article.authorId),
			(async () => {
				const relationships = await AppwriteService.getArticleTagsbyArticle(article.$id);

				const tagIds = [
					...new Set(relationships.documents.map((relationship) => relationship.tagId))
				];

				if(tagIds.length <= 0) {
					return [];
				}

				const tags = await AppwriteService.getTags(tagIds);
				return tags.documents;
			})()
		]);

		article.category = category;
		article.author = author;
		article.tags = tags;

		return article;
	},
	getArticles: async (queries?: string[]) => {
		if (!queries) {
			queries = [];
		}

		queries.push(
			...[
				Query.limit(PageSize.Articles + 1),
				Query.orderDesc('$createdAt'),
				Query.equal('isPublished', true)
			]
		);

		const articles = await databases.listDocuments<Article>('default', 'articles', queries);

		const categoryIds = [...new Set(articles.documents.map((article) => article.categoryId))];
		const authorIds = [...new Set(articles.documents.map((article) => article.authorId))];

		let categories: Category[] = [];
		let authors: Author[] = [];

		await Promise.all([
			(async () => {
				if (categoryIds.length > 0) {
					categories = (await AppwriteService.getCategories(categoryIds)).documents;
				}
			})(),
			(async () => {
				if (authorIds.length > 0) {
					authors = (await AppwriteService.getAuthors(authorIds)).documents;
				}
			})()
		]);

		articles.documents = articles.documents.map((article) => {
			return {
				...article,
				category: categories.find((category) => category.$id === article.categoryId),
				author: authors.find((author) => author.$id === article.authorId),
				verboseDate: getVerboseDate(article.$createdAt)
			};
		});

		return articles;
	},
	getThumbnail: (fileId: string, width?: number, height?: number, format = 'webp') => {
		return storage
			.getFilePreview(
				'thumbnails',
				fileId,
				width ? width : 500,
				height,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				format
			)
			.toString();
	},
	getProfileImage: (fileId: string, width?: number, height?: number) => {
		return storage
			.getFilePreview(
				'profilePictures',
				fileId,
				width ? width : 500,
				height,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				'webp'
			)
			.toString();
	}
};
